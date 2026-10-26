const params = new URLSearchParams(window.location.search)
const room = params.get("room");
const username = params.get("username");

const input = document.getElementById('input')
const box = document.getElementById('messages')
const div = document.createElement("div");
div.textContent = "Привет";
box.appendChild(div);
const send = document.getElementById('send')

const ws = new WebSocket(`ws://localhost:8080/ws/${room}?username=${username}`)

ws.onopen = (event) => {
  input.disabled = false;
}

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  div.textContent = div.textContent + "\n" + msg.text
  box.appendChild(div);
};
