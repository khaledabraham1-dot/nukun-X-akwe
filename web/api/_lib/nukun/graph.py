"""GraphSAGE orienté à moyennes entrantes et sortantes, sans embedding d'identifiant.

L'agrégation est une variante à voisinage complet de GraphSAGE. Le graphe de
chaque intervalle contient seulement les événements strictement antérieurs.
PyTorch est optionnel et n'est pas requis pour le prototype tabulaire.
"""

from dataclasses import dataclass
import math
from time import perf_counter

import numpy as np

from nukun.features import History
from nukun.simulation import Declaration, Transaction


NODE_FEATURES = ["log_in_count", "log_unique_in", "log_out_count", "log_unique_out",
                 "log_in_amount", "log_out_amount", "log_age", "repeat_share", "turnover", "matched_share"]


@dataclass
class Snapshot:
    start: int
    names: list[str]
    node_x: np.ndarray
    edges: np.ndarray  # [source, destination], dédupliquées
    transaction_indices: np.ndarray
    senders: np.ndarray
    receivers: np.ndarray


def snapshot(history: History, transactions: list[Transaction], start: int,
             indices: np.ndarray) -> Snapshot:
    if history.last_observed >= start:
        raise ValueError("L'instantané doit précéder toutes les transactions de son intervalle.")
    names = sorted(set(history.accounts) | {a for t in transactions for a in (t.sender, t.receiver)})
    mapping = {name: i for i, name in enumerate(names)}
    rows, edges = [], set()
    for name in names:
        account = history.accounts.get(name)
        incoming = [] if account is None else [t for t in account.incoming if start - history.window <= t.timestamp < start]
        outgoing = [] if account is None else [t for t in account.outgoing if start - history.window <= t.timestamp < start]
        in_amount, out_amount = sum(t.amount for t in incoming), sum(t.amount for t in outgoing)
        counts = {}
        for tx in incoming:
            counts[tx.sender] = counts.get(tx.sender, 0) + 1
            edges.add((mapping[tx.sender], mapping[name]))
        repeat = sum(n for n in counts.values() if n > 1) / max(1, len(incoming))
        matched = sum(t.amount for t in incoming if t.id in history.matches and history.matches[t.id].known_at < start)
        rows.append([
            math.log1p(len(incoming)), math.log1p(len(counts)), math.log1p(len(outgoing)),
            math.log1p(len({t.receiver for t in outgoing})), math.log1p(in_amount), math.log1p(out_amount),
            math.log1p(0 if account is None else max(0, (start - account.first_seen) / 86400)),
            repeat, min(3, out_amount / max(1, in_amount)), min(1, matched / max(1, in_amount)),
        ])
    edge_array = np.array(sorted(edges), dtype=np.int64).T if edges else np.empty((2, 0), dtype=np.int64)
    return Snapshot(start, names, np.array(rows, dtype=np.float32), edge_array, np.array(indices, dtype=np.int64),
                    np.array([mapping[t.sender] for t in transactions]),
                    np.array([mapping[t.receiver] for t in transactions]))


def build_snapshots(transactions: list[Transaction], declarations: list[Declaration], seconds: int = 43200):
    if seconds <= 0:
        raise ValueError("La durée d'instantané doit être positive.")
    history, result = History(), []
    declarations = sorted(declarations, key=lambda d: d.known_at)
    cursor, position = 0, 0
    while position < len(transactions):
        start = transactions[position].timestamp // seconds * seconds
        end = position
        while end < len(transactions) and transactions[end].timestamp < start + seconds:
            end += 1
        while cursor < len(declarations) and declarations[cursor].known_at < start:
            history.confirm(declarations[cursor], start)
            cursor += 1
        group = transactions[position:end]
        result.append(snapshot(history, group, start, np.arange(position, end)))
        for tx in group:
            history.observe(tx)
        position = end
    return result


def _torch():
    try:
        import torch
    except ImportError as exc:
        raise RuntimeError("PyTorch manque. Utilisez l'environnement GPU ou installez requirements-graph.txt.") from exc
    return torch


def make_network(node_dim: int, transaction_dim: int, hidden: int, aggregate: bool):
    torch = _torch()
    nn = torch.nn

    class DirectedSAGE(nn.Module):
        def __init__(self):
            super().__init__()
            self.first = nn.Linear(node_dim * 3, hidden)
            self.second = nn.Linear(hidden * 3, hidden)
            self.head = nn.Sequential(nn.Linear(hidden * 2 + transaction_dim, hidden), nn.ReLU(), nn.Linear(hidden, 1))

        def layer(self, x, incoming, outgoing, transform):
            if aggregate:
                neighbors_in = torch.sparse.mm(incoming, x)
                neighbors_out = torch.sparse.mm(outgoing, x)
            else:
                neighbors_in, neighbors_out = torch.zeros_like(x), torch.zeros_like(x)
            return torch.relu(transform(torch.cat([x, neighbors_in, neighbors_out], dim=1)))

        def forward(self, node_x, incoming, outgoing, sender, receiver, tx_x):
            h = self.layer(node_x, incoming, outgoing, self.first)
            h = self.layer(h, incoming, outgoing, self.second)
            h = torch.nn.functional.normalize(h, p=2, dim=1)
            return self.head(torch.cat([h[sender], h[receiver], tx_x], dim=1)).squeeze(-1)

    return DirectedSAGE()


def mean_adjacency(edges: np.ndarray, n: int, device, reverse: bool = False):
    torch = _torch()
    # Ligne = nœud à mettre à jour, colonne = voisin à agréger.
    row, col = (edges[0], edges[1]) if reverse else (edges[1], edges[0])
    degree = np.bincount(row, minlength=n)
    values = 1 / np.maximum(1, degree[row]).astype(np.float32)
    return torch.sparse_coo_tensor(torch.tensor(np.stack([row, col]), device=device),
                                   torch.tensor(values, device=device), (n, n), device=device,
                                   check_invariants=True).coalesce()


@dataclass
class GraphModel:
    network: object
    node_mean: np.ndarray
    node_scale: np.ndarray
    tx_mean: np.ndarray
    tx_scale: np.ndarray
    context: bool
    aggregate: bool
    hidden: int
    device: str

    def tensors(self, snap: Snapshot, x: np.ndarray, blackout: bool = False):
        torch = _torch()
        node = snap.node_x[:, :10 if self.context else 9].copy()
        tx = x[snap.transaction_indices, :12 if self.context else 9].copy()
        if blackout and self.context:
            node[:, 9:] = 0
            tx[:, 9:] = 0
        return (
            torch.tensor((node - self.node_mean) / self.node_scale, dtype=torch.float32, device=self.device),
            mean_adjacency(snap.edges, len(snap.names), self.device),
            mean_adjacency(snap.edges, len(snap.names), self.device, reverse=True),
            torch.tensor(snap.senders, dtype=torch.long, device=self.device),
            torch.tensor(snap.receivers, dtype=torch.long, device=self.device),
            torch.tensor((tx - self.tx_mean) / self.tx_scale, dtype=torch.float32, device=self.device),
        )

    def predict(self, snapshots: list[Snapshot], x: np.ndarray, blackout: bool = False):
        torch = _torch()
        covered = np.concatenate([s.transaction_indices for s in snapshots]) if snapshots else np.array([])
        if not np.array_equal(np.sort(covered), np.arange(len(x))):
            raise ValueError("Les instantanés doivent couvrir chaque transaction exactement une fois.")
        result = np.empty(len(x), dtype=np.float64)
        self.network.eval()
        with torch.no_grad():
            for snap in snapshots:
                values = torch.sigmoid(self.network(*self.tensors(snap, x, blackout)))
                result[snap.transaction_indices] = values.cpu().numpy()
        return result

    def to_dict(self):
        return {"type": "directed_mean_graphsage_v1", "context": self.context, "aggregate": self.aggregate,
                "hidden": self.hidden, "node_mean": self.node_mean.tolist(), "node_scale": self.node_scale.tolist(),
                "tx_mean": self.tx_mean.tolist(), "tx_scale": self.tx_scale.tolist(),
                "state": {key: value.detach().cpu().tolist() for key, value in self.network.state_dict().items()}}

    @classmethod
    def from_dict(cls, obj: dict, device: str = "cpu"):
        torch = _torch()
        if obj["type"] != "directed_mean_graphsage_v1":
            raise ValueError("Type de modèle inconnu.")
        network = make_network(len(obj["node_mean"]), len(obj["tx_mean"]), obj["hidden"], obj["aggregate"]).to(device)
        network.load_state_dict({key: torch.tensor(value, dtype=torch.float32, device=device)
                                 for key, value in obj["state"].items()})
        return cls(network, np.array(obj["node_mean"]), np.array(obj["node_scale"]),
                   np.array(obj["tx_mean"]), np.array(obj["tx_scale"]), obj["context"], obj["aggregate"], obj["hidden"], device)


def fit_graph(snapshots: list[Snapshot], x: np.ndarray, y: np.ndarray, train_mask: np.ndarray,
              train_cut: int, context: bool, aggregate: bool, seed: int, hidden: int = 24,
              epochs: int = 20, learning_rate: float = .003, device: str = "cpu"):
    torch = _torch()
    if device == "cuda" and not torch.cuda.is_available():
        raise RuntimeError("CUDA demandé mais aucun GPU CUDA utilisable. Aucun repli silencieux.")
    torch.set_num_threads(2)
    torch.manual_seed(seed)
    torch.use_deterministic_algorithms(True)
    if device == "cuda":
        torch.cuda.reset_peak_memory_stats()
    nd, td = (10, 12) if context else (9, 9)
    training_snaps = [s for s in snapshots if s.start < train_cut]
    for snap in training_snaps:
        if not np.all(train_mask[snap.transaction_indices]):
            raise ValueError("Une frontière de partition coupe un instantané d'entraînement.")
    node_train = np.concatenate([s.node_x[:, :nd] for s in training_snaps])
    tx_train = x[train_mask, :td]
    def statistics(a):
        mean, scale = a.mean(0), a.std(0)
        return mean, np.where(scale < 1e-6, 1, scale)
    node_mean, node_scale = statistics(node_train)
    tx_mean, tx_scale = statistics(tx_train)
    model = GraphModel(make_network(nd, td, hidden, aggregate).to(device), node_mean, node_scale,
                       tx_mean, tx_scale, context, aggregate, hidden, device)
    batches = [model.tensors(s, x) for s in training_snaps]
    prevalence = float(y[train_mask].mean())
    if not 0 < prevalence < 1:
        raise ValueError("Les deux classes sont nécessaires à l'entraînement.")
    weights = torch.tensor([.5 / (1 - prevalence), .5 / prevalence], dtype=torch.float32, device=device)
    targets = [torch.tensor(y[s.transaction_indices], dtype=torch.float32, device=device) for s in training_snaps]
    optimizer = torch.optim.AdamW(model.network.parameters(), lr=learning_rate, weight_decay=.01)
    criterion = torch.nn.BCEWithLogitsLoss(reduction="none")
    rng = np.random.default_rng(seed)
    tick = perf_counter()
    model.network.train()
    loss_history = []
    for _ in range(epochs):
        total = 0.0
        for index in rng.permutation(len(batches)):
            optimizer.zero_grad(set_to_none=True)
            logits = model.network(*batches[index])
            target = targets[index]
            loss = (criterion(logits, target) * weights[target.long()]).mean()
            if not torch.isfinite(loss):
                raise ValueError("Perte d'entraînement non finie.")
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.network.parameters(), 5.0)
            optimizer.step()
            total += float(loss.detach().cpu())
        loss_history.append(total / len(batches))
    if device == "cuda":
        torch.cuda.synchronize()
    return model, {"seconds": perf_counter() - tick, "epochs": epochs, "loss_by_epoch": loss_history,
                   "parameters": sum(p.numel() for p in model.network.parameters()), "device": device,
                   "peak_vram_bytes": torch.cuda.max_memory_allocated() if device == "cuda" else None}
