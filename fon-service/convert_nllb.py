# Conversion NLLB -> CTranslate2 int8 (contourne l'incompatibilité dtype/torch_dtype entre ctranslate2 4.9 et transformers 4.46)
from ctranslate2.converters import TransformersConverter

class Conv(TransformersConverter):
    def load_model(self, model_class, model_name_or_path, **kwargs):
        if "dtype" in kwargs:
            kwargs["torch_dtype"] = kwargs.pop("dtype")
        return model_class.from_pretrained(model_name_or_path, **kwargs)

Conv("facebook/nllb-200-distilled-600M", low_cpu_mem_usage=True).convert(
    "models/nllb-200-distilled-600M-ct2-int8", quantization="int8", force=True)
print("conversion ok")
