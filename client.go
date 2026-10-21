package main

import (
	"fmt"

	"github.com/gorilla/websocket"
)

type Client struct {
	conn *websocket.Conn
	send chan []byte
}

func readPump(hub *hub, cl *Client) {
	for {
		_, data, err := cl.conn.ReadMessage()
		if err != nil {
			hub.unregister <- cl
			return
		}
		hub.broadcast <- data
	}
}

func writePump(cl *Client) {
	defer cl.conn.Close()
	for data := range cl.send {
		err := cl.conn.WriteMessage(websocket.TextMessage, data)
		if err != nil {
			fmt.Println("WritePumpErr: ", err)
			return
		}
	}
}
