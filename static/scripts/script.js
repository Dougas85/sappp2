document.addEventListener('DOMContentLoaded', function () {
    let viewedItems = new Set();

    function atualizarCalendario() {
        const calendar = document.getElementById('calendar');
        calendar.innerHTML = ''; // Limpa os dias atuais

        const listaSelecionada = document.getElementById('listaSelect').value;
        const totalDias = listaSelecionada === 'CHECKLIST' ? 60 : 64;

        for (let i = 1; i <= totalDias; i++) {
            const day = document.createElement('div');
            day.innerText = i;
            day.id = `day-${i}`;
            day.classList.add('calendar-item', 'red-item');
            calendar.appendChild(day);

            day.addEventListener("click", function () {
                showItemDetails(i);
            });
        }

        // Negrito para peso 5
        fetch(`/get_all_items?lista=${listaSelecionada}`)
            .then(response => response.json())
            .then(data => {
                data.forEach(item => {
                    if (item.peso === 5 && parseInt(item.numero) <= totalDias) {
                        const el = document.getElementById(`day-${item.numero}`);
                        if (el) {
                            el.classList.add('bold-day');
                        }
                    }
                });
            });
    }

    document.getElementById('listaSelect').addEventListener('change', atualizarCalendario);
    atualizarCalendario(); // Chamada inicial

    document.getElementById('showLinesButton').addEventListener('click', function () {
        const selectedList = document.getElementById('listaSelect').value;
        if (!selectedList) {
            alert("Por favor, selecione uma lista antes de continuar.");
            return;
        }

        fetch(`/get_lines?lista=${selectedList}`)
            .then(response => response.json())
            .then(data => {
                const tableBody = document.getElementById('itemsTable').querySelector('tbody');
                tableBody.innerHTML = '';

                data.forEach((line) => {
                    const newRow = tableBody.insertRow();
                    const itemCell = newRow.insertCell(0);
                    const actionCell = newRow.insertCell(1);

                    const descricao = line.descricao || "Sem informação";
                    itemCell.innerText = `Item ${line.numero}: ${descricao}`;

                    const btn = document.createElement('button');
                    btn.innerText = "Ver Detalhes";
                    btn.classList.add('open-dialog');

                    btn.addEventListener('click', function () {
                        openModal(line.numero, descricao, line.orientacao, line.referencia, line.peso);
                    });

                    actionCell.appendChild(btn);

                    const dayElement = document.getElementById(`day-${line.numero}`);
                    if (dayElement) {
                        dayElement.classList.remove('red-item');
                        dayElement.classList.add('viewed');
                        viewedItems.add(line.numero);
                    }
                });

                if (viewedItems.size >= 64) {
                    viewedItems.clear();
                    document.querySelectorAll('.calendar-item').forEach(day => {
                        day.classList.remove('viewed');
                        day.classList.add('red-item');
                    });
                }
            })
            .catch(error => console.error("Erro ao carregar os itens:", error));
    });

    document.getElementById('searchButton').addEventListener('click', function () {
        const selectedList = document.getElementById('listaSelect').value;
        const searchQuery = document.getElementById('searchInput').value.toLowerCase();

        if (searchQuery.trim() === "") {
            alert("Por favor, insira uma palavra-chave para pesquisa.");
            return;
        }

        fetch(`/search_items/${searchQuery}?lista=${selectedList}`)
            .then(response => response.json())
            .then(data => {
                const tableBody = document.getElementById('itemsTable').querySelector('tbody');
                tableBody.innerHTML = '';

                data.forEach((line) => {
                    const newRow = tableBody.insertRow();
                    const itemCell = newRow.insertCell(0);
                    const actionCell = newRow.insertCell(1);

                    const descricao = line.descricao || "Sem informação";
                    itemCell.innerText = `Item ${line.numero}: ${descricao}`;

                    const btn = document.createElement('button');
                    btn.innerText = "Ver Detalhes";
                    btn.classList.add('open-dialog');

                    btn.addEventListener('click', function () {
                        openModal(line.numero, descricao, line.orientacao, line.referencia, line.peso);
                    });

                    actionCell.appendChild(btn);
                });
            })
            .catch(error => console.error("Erro ao buscar os itens:", error));
    });

    function showItemDetails(itemNum) {
        const lista = document.getElementById('listaSelect').value;

        fetch(`/get_item_details/${itemNum}?lista=${lista}`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert("Item não encontrado!");
                } else {
                    openModal(data.numero, data.descricao, data.orientacao, data.referencia, data.peso);
                }
            })
            .catch(error => console.error("Erro ao buscar detalhes:", error));
    }

    function openModal(numero, descricao, orientacao, referencia, peso) {
        document.getElementById('modalItem').innerText = `Item ${numero}`;
        document.getElementById('modalOrientation').innerText = orientacao || "Sem orientação";
        document.getElementById('modalReference').innerText = referencia || "Sem referência";
        document.getElementById('modalDescription').innerText = descricao || "Sem informação";
        document.getElementById('modalWeight').innerText = peso || "Sem peso";

        document.getElementById('dialogBox').showModal();

        const textoParaFalar = `Descrição: ${descricao || "Sem informação"}. Orientação: ${orientacao || "Sem orientação"}. Referência: ${referencia || "Sem referência"}.`;
        document.getElementById('startSpeechButton').onclick = function () {
            speakText(textoParaFalar);
        };
    }

    function speakText(text) {
        const cleanedText = text.replace(/([:;.,])/g, '$1 ');

        const voices = window.speechSynthesis.getVoices();
        const selectedVoice = voices.find(voice =>
            voice.lang === 'pt-BR' &&
            (
                voice.name.includes('Google') ||
                voice.name.includes('Luciana') ||
                voice.name.includes('Daniel') ||
                voice.name.includes('Microsoft')
            )
        ) || voices.find(voice => voice.lang === 'pt-BR');

        const utterance = new SpeechSynthesisUtterance(cleanedText);
        utterance.voice = selectedVoice;
        utterance.rate = 0.9;
        utterance.lang = 'pt-BR';

        const animation = document.getElementById("speechAnimation");
        if (animation) animation.style.display = "block";

        utterance.onend = () => {
            if (animation) animation.style.display = "none";
        };

        window.speechSynthesis.speak(utterance);
    }

    document.getElementById("stopSpeechButton").addEventListener("click", function (event) {
        event.preventDefault();
        window.speechSynthesis.cancel();
        const animation = document.getElementById("speechAnimation");
        if (animation) animation.style.display = "none";
    });

    document.getElementById('closeDialog').addEventListener('click', function () {
        document.getElementById('dialogBox').close();
        window.speechSynthesis.cancel();
        document.getElementById("speechAnimation").style.display = "none";
    });

    window.addEventListener('click', function (event) {
        const modal = document.getElementById('dialogBox');
        if (event.target === modal) {
            modal.close();
            window.speechSynthesis.cancel();
            document.getElementById("speechAnimation").style.display = "none";
        }
    });

    window.speechSynthesis.onvoiceschanged = function () {
        window.speechSynthesis.getVoices(); // Atualiza vozes
    };
});
