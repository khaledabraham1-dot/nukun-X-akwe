from io import BytesIO
import unittest
import wave

from nukun.voice import transcribe


class VoiceTests(unittest.TestCase):
    def test_wav_validation_before_recognition(self):
        for channels, width, rate, frames, trim, message in [
            (2, 2, 16000, 20, 0, "mono"),
            (1, 1, 16000, 20, 0, "16 bits"),
            (1, 2, 8000, 20, 0, "16–48"),
            (1, 2, 96000, 20, 0, "16–48"),
            (1, 2, 16000, 60 * 16000 + 1, 0, "60 secondes"),
            (1, 2, 16000, 20, 1, "incomplet"),
        ]:
            with self.subTest(channels=channels, width=width, rate=rate, frames=frames, trim=trim):
                data = BytesIO()
                with wave.open(data, "wb") as wav:
                    wav.setparams((channels, width, rate, 0, "NONE", ""))
                    wav.writeframes(bytes(frames * channels * width))
                payload = data.getvalue()
                with self.assertRaisesRegex(ValueError, message):
                    transcribe(payload[:len(payload) - trim])

    def test_invalid_or_empty_upload(self):
        for data in (b"", b"invalid file", bytes(8_000_001)):
            with self.subTest(size=len(data)), self.assertRaises(ValueError):
                transcribe(data)

    def test_empty_recording(self):
        data = BytesIO()
        with wave.open(data, "wb") as wav:
            wav.setparams((1, 2, 16000, 0, "NONE", ""))
        with self.assertRaisesRegex(ValueError, "60 secondes"):
            transcribe(data.getvalue())
