async function loadWord() {
    const res = await fetch("/word");
    const data = await res.json();
    document.getElementById("word").innerText = "Слово: " + data.word;
    window.currentWord = data.word;
}

loadWord();