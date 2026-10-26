
const BACKEND_PORT = 8080; // порт бэкенда на локалке
const MAX_RECONNECT_DELAY = 30000; // макс. пауза перед реконнектом, мс
const INITIAL_RECONNECT_DELAY = 1000;


(function loadInterFont() {
    if (document.querySelector('link[href*="fonts.googleapis.com"][href*="Inter"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap';
    document.head.appendChild(link);
})();

const params = new URLSearchParams(window.location.search);
const room = params.get("room");
const username = params.get("username");

const input = document.getElementById('input');
const sendBtn = document.getElementById('send');
const box = document.getElementById('messages');

box.innerHTML = '';

let ws = null;
let reconnectDelay = INITIAL_RECONNECT_DELAY;
let isConnected = false;


function formatTime(timestamp) {
    let ts = timestamp;
    if (ts && ts < 1e12) ts *= 1000; // секунды → мс
    const date = ts ? new Date(ts) : new Date();
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
}

function getColorForUsername(name) {
    const colors = [
        '#5b60ff', '#10b981', '#f59e0b', '#ef4444',
        '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

function buildWsUrl() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    const host = isDev ? `${location.hostname}:${BACKEND_PORT}` : location.host;
    return `${protocol}//${host}/ws/${room}?username=${username}`;
}

function addMessage(text, type = 'incoming', author = '', timestamp = null) {
    const msg = document.createElement('div');
    msg.className = `message ${type}`;

    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';

    if (type === 'incoming' && author) {
        const header = document.createElement('div');
        header.className = 'message-header';

        const authorSpan = document.createElement('span');
        authorSpan.className = 'message-author';
        authorSpan.textContent = author;
        authorSpan.style.color = getColorForUsername(author);

        const timeSpan = document.createElement('span');
        timeSpan.className = 'message-time';
        timeSpan.textContent = formatTime(timestamp);

        header.appendChild(authorSpan);
        header.appendChild(timeSpan);
        textDiv.appendChild(header);
    } else if (type === 'outgoing') {
        const header = document.createElement('div');
        header.className = 'message-header';

        const timeSpan = document.createElement('span');
        timeSpan.className = 'message-time';
        timeSpan.textContent = formatTime(timestamp);

        header.appendChild(timeSpan);
        textDiv.appendChild(header);
    }

    const content = document.createElement('span');
    content.className = 'message-content';
    content.textContent = text;
    textDiv.appendChild(content);

    msg.appendChild(textDiv);
    box.appendChild(msg);

    box.scrollTop = box.scrollHeight;
}

function connect() {
    if (!room || !username) {
        addMessage('⚠️ Не указан room или username. Добавьте ?room=имя_комнаты&username=ваш_ник к URL', 'system');
        input.disabled = true;
        sendBtn.disabled = true;
        return;
    }

    const url = buildWsUrl();
    ws = new WebSocket(url);

    ws.onopen = () => {
        isConnected = true;
        reconnectDelay = INITIAL_RECONNECT_DELAY; // сбрасываем бэкофф
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
        addMessage(`Подключено к комнате «${room}». Вы вошли как ${username}.`, 'system');
    };

    ws.onmessage = (event) => {
        let data;
        try {
            data = JSON.parse(event.data);
        } catch {
            addMessage(event.data, 'incoming');
            return;
        }

        const text = data.text ?? data.message ?? '';

        if (data.type === 'system' || data.system) {
            addMessage(text, 'system');
            return;
        }

        const type = data.username === username ? 'outgoing' : 'incoming';
        addMessage(text, type, data.username || '', data.timestamp);
    };

    ws.onerror = (err) => {
        console.error('WebSocket error:', err);
    };

    ws.onclose = (event) => {
        const wasConnected = isConnected;
        isConnected = false;
        input.disabled = true;
        sendBtn.disabled = true;

        if (event.code === 1000 || event.wasClean) {
            addMessage(`Соединение закрыто (код: ${event.code})`, 'system');
            return;
        }

        const secs = Math.round(reconnectDelay / 1000);
        addMessage(
            wasConnected
                ? `Соединение потеряно. Переподключение через ${secs}с…`
                : `Не удалось подключиться. Повтор через ${secs}с…`,
            'system'
        );

        setTimeout(() => {

            if (document.hidden) return;
            connect();
        }, reconnectDelay);

        reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
    };
}

function sendMessage() {
    const text = input.value.trim();
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(text);
    input.value = '';
    input.focus();
}

sendBtn.addEventListener('click', sendMessage);
input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

document.addEventListener('visibilitychange', () => {
    if (!document.hidden && (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING)) {
        reconnectDelay = INITIAL_RECONNECT_DELAY;
        connect();
    }
});

connect();
