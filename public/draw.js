window.currentWord = null;

// Загружаем 3 слова с сервера
async function loadWords() {
    const res = await fetch("/api/words");
    const data = await res.json();
    renderWords(data.words);
}

function renderWords(words) {
    const box = document.getElementById("wordChoice");
    box.innerHTML = "<p>Выберите слово:</p>";

    words.forEach(word => {
        const btn = document.createElement("button");
        btn.textContent = word;

        btn.onclick = () => {
            window.currentWord = word;

            // визуально показываем выбор
            box.innerHTML = `<strong>Вы выбрали: ${word}</strong>`;
        };

        box.appendChild(btn);
    });
}

// ⬅️ ВАЖНО: запускаем загрузку
loadWords();
