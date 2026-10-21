package main

import (
	"fmt"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func (h *hub) baseHandler(w http.ResponseWriter, r *http.Request) { //http handler
	conn, err := upgrader.Upgrade(w, r, nil)

	if err != nil {
		fmt.Println("error: ", err)
		return
	}

	cl := &Client{
		conn: conn,
		send: make(chan []byte, 256),
	}

	h.register <- cl

	go readPump(h, cl)
	writePump(cl)

}

func main() {
	Hub := newHub() //start hub
	go Hub.Run()

	http.HandleFunc("/ws", Hub.baseHandler) //handle net

	err := http.ListenAndServe(":8080", nil)

	if err != nil {
		fmt.Println(err)
		return
	}
}
