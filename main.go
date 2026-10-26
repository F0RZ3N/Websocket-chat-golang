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
	if r.PathValue("roomID") == "" || r.URL.Query().Get("username") == "" {
		w.WriteHeader(400)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)

	if err != nil {
		fmt.Println("error: ", err)
		return
	}

	cl := &Client{
		roomID:   r.PathValue("roomID"),
		username: r.URL.Query().Get("username"),
		conn:     conn,
		send:     make(chan []byte, 256),
	}

	h.register <- cl

	go readPump(h, cl)
	writePump(cl)

}

func main() {
	mux := http.NewServeMux()
	Hub := newHub() //start hub
	go Hub.Run()

	mux.HandleFunc("/ws/{roomID}", Hub.baseHandler) // handle websocket

	fileServer := http.FileServer(http.Dir("web"))
	mux.Handle("/", fileServer) // handle static

	fmt.Println("Сервер запущен на :8080...")
	if err := http.ListenAndServe(":8080", mux); err != nil {
		panic(err)
	}
}
