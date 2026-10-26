# 💬 WebSocket Chat (Go + JS)

![Go](https://img.shields.io/badge/Go-1.26+-00ADD8.svg?style=flat&logo=go)
![WebSocket](https://img.shields.io/badge/WebSocket-Gorilla-orange)
![Frontend](https://img.shields.io/badge/Frontend-vanilla%20JS-yellow)
![License](https://img.shields.io/badge/license-MIT-green)

Реалтайм чат с комнатами на Go. Фронтенд на чистом JavaScript без фреймворков. Пользователи подключаются по WebSocket, общаются в изолированных комнатах, видят историю сообщений и получают уведомления о входах/выходах.

---

## ✨ Возможности

- 🏠 **Комнаты** — изолированные чаты по URL (`/ws/{roomID}?username=...`)
- 📜 **История сообщений** — последние 50 сообщений отдаются новичку при подключении
- 🔔 **Системные уведомления** — «User joined», «User left»
- 🔄 **Автоматический реконнект** с exponential backoff (1с → 2с → 4с → ... → 30с)
- 🎨 **Динамическая палитра** — цвет ника вычисляется из хеша имени
- 🛡 **XSS-защита** — пользовательский текст рендерится через `textContent`, не `innerHTML`
- ⚡ **Конкурентный бэкенд** — hub pattern на горутинах и каналах, без мьютексов

## 🛠 Технологии

| Слой | Технология | Зачем |
|------|-----------|-------|
| Backend | Go + `gorilla/websocket` | WebSocket протокол, конкурентность |
| Frontend | Vanilla JS + HTML + CSS | Лёгкий стек без React/Vue |
| Архитектура | Hub pattern (register/unregister/broadcast) | Единственный владелец состояния |
| Конкурентность | Горутины + каналы (`chan`) | Без мьютексов, без гонок |
| Сериализация | `encoding/json` | JSON-конверты сообщений |

## 📦 Структура проекта

```
websocket-chat/
├── main.go           # точка входа: HTTP-сервер, маршруты, раздача статики
├── hub.go            # Hub: комнаты, register/unregister/broadcast, Run()
├── client.go         # Client: readPump / writePump (две горутины на соединение)
├── message.go        # JSON-конверт сообщения, типы (message/system)
├── web/
│   ├── index.html    # страница чата
│   ├── app.js        # WS-клиент, реконнект, рендеринг
│   └── style.css     # оформление (вайбкодинг)
├── README.md
└── .gitignore
```

## 🚀 Быстрый старт

### 1. Запуск сервера

```bash
go run .
```

Сервер стартует на `http://localhost:8080`.

### 2. Открыть чат

Перейди в браузер:
```
http://localhost:8080/?room=general&username=Alice
```

Открой вторую вкладку с другим ником:
```
http://localhost:8080/?room=general&username=Bob
```

Сообщения из одной вкладки появятся в другой в реальном времени.

## 🏗 Архитектура

### Hub Pattern

```
┌─────────────────────────────────────────────────────────┐
│                      HTTP Server                         │
│  /ws/{roomID}?username=...  →  Upgrade to WebSocket     │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    Hub (Run goroutine)                   │
│                                                          │
│  rooms: map[roomID]*Room                                │
│                                                          │
│  Room {                                                 │
│    clients: map[*Client]bool                            │
│    history: []Message (последние 50)                    │
│  }                                                      │
│                                                          │
│  Каналы:                                                │
│    register   chan *Client   ← новый клиент            │
│    unregister chan *Client   ← клиент ушёл             │
│    broadcast  chan Broadcast ← сообщение для комнаты   │
└───────────────────────┬─────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
   ┌─────────┐    ┌─────────┐    ┌─────────┐
   │ Client  │    │ Client  │    │ Client  │
   │ readPump│    │ readPump│    │ readPump│  ← читают из conn
   │writePump│    │writePump│    │writePump│  ← пишут в conn
   └─────────┘    └─────────┘    └─────────┘
```

### Жизненный цикл соединения

1. **Подключение**: `GET /ws/general?username=Alice`
   - HTTP → WebSocket upgrade
   - Создание `Client{conn, send, roomID, username}`
   - `hub.register <- client`
   - Запуск `go readPump()` + `writePump()`

2. **Отправка сообщения**:
   - `readPump` читает из `conn`
   - Оборачивает в JSON-конверт: `Message{type, username, text, timestamp}`
   - `hub.broadcast <- Broadcast{roomID, data, msg}`
   - Hub добавляет в `history`, рассылает всем в комнате

3. **Отключение**:
   - `readPump` видит ошибку чтения
   - `hub.unregister <- client`
   - Hub удаляет из map, закрывает `send`
   - `writePump` завершается
   - Рассылается системное сообщение «User left»

### Решения

|---------|--------|
| **Hub как единственный владелец состояния** | Все мутации map'ов комнат только в `Run()` через каналы → нет гонок |
| **Две горутины на соединение** (readPump/writePump) | WebSocket не потокобезопасен на запись; разделение чтения/записи |
| **Буферизованный `send`** (256) | Медленный клиент не блокирует hub |
| **История в hub, не в БД** | Для чата персистентность не нужна; перезапуск = чистая история |
| **Get-or-create комната в register** | Первая регистрация создаёт комнату; пустая комната удаляется |
| **JSON-конверты** | Типизация сообщений (message/system) на уровне протокола |

## 📚 Команды

Просто открой URL с параметрами:
```
http://localhost:8080/?room={комната}&username={ник}
```

Параметры:
- `room` — имя комнаты (любая строка)
- `username` — имя пользователя

Примеры:
```
http://localhost:8080/?room=general&username=Alice
http://localhost:8080/?room=dev&username=Bob
http://localhost:8080/?room=random&username=Charlie
```

### Backend (Go)
- [x] **WebSocket протокол** — upgrade, фреймы, закрытие соединения
- [x] **Hub pattern** — register/unregister/broadcast через каналы
- [x] **Комнаты с изоляцией** — map комнат, fan-out broadcast
- [x] **История сообщений** — срез с лимитом 50, отдача новичку
- [x] **Две горутины на соединение** — readPump/writePump
- [x] **JSON-конверты** — типизация сообщений через поле `type`
- [x] **Get-or-create паттерн** — создание комнаты при первой регистрации
- [x] **Graceful shutdown** — закрытие каналов, завершение горутин

### Frontend (JS) — вайбкодинг
- [ ] WebSocket API (`new WebSocket`, `onmessage`, `onclose`)
- [ ] Exponential backoff для реконнекта
- [ ] Рендеринг сообщений через `textContent` (XSS-защита)
- [ ] Динамическая палитра цветов по хешу ника
- [ ] Автоматическая прокрутка ленты вниз


## ⚠️ Известные ограничения

- Нет персистентности истории (перезапуск сервера = потеря сообщений)
- Нет аутентификации (любой может подключиться с любым ником)
- Нет модерации (нет бана, удаления сообщений)
- Нет typing indicators («Alice печатает...»)
- Нет списка онлайн-участников
- Нет звуковых уведомлений

## 🗺 Roadmap

- [ ] Персистентность истории через SQLite/PostgreSQL
- [ ] Typing indicators через отдельный тип сообщения
- [ ] Список онлайн-участников (heartbeat от клиентов)
- [ ] Аутентификация через JWT
- [ ] Комнаты с паролями
- [ ] Inline-кнопки «Удалить сообщение»
- [ ] Звуковые уведомления при новом сообщении

## 📊 Сравнение с другими проектами

| Проект | Стек | Конкурентность | Реалтайм |
|--------|------|----------------|----------|
| URL Shortener (Go) | HTTP + SQLite | — | — |
| Uptime Monitor | Telegram + Worker Pool | Каналы + WaitGroup | — |
| **WebSocket Chat** | WebSocket + Hub | Горутины + каналы | ✅ |

## 🎓 Выводы

**Что получилось:**
- Полноценный реалтайм чат с комнатами и историей
- Чистая архитектура hub pattern без мьютексов
- Первый full-stack проект (бэкенд + фронтенд)

---

*Восьмой проект серии: terminal-chat → REST API → URL Shortener (C++) → HTTP Client → URL Shortener (Go) → TG Bot → Uptime Monitor → **WebSocket Chat*** 🚀
```

---

## 📦 .gitignore

```
websocket-chat
*.exe
*.db
web/*.db
