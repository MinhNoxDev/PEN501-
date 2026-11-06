export function speakVocabularyWord(value) {
  const word = String(value ?? "").trim();
  if (!word || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return false;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "en-US";
  utterance.rate = 0.88;
  const voices = window.speechSynthesis.getVoices();
  utterance.voice = voices.find((voice) => /^en-US$/i.test(voice.lang))
    || voices.find((voice) => /^en-/i.test(voice.lang))
    || null;
  window.speechSynthesis.speak(utterance);
  return true;
}
