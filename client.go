package main

import (
	"encoding/json/v2"
	"fmt"
	"time"

	"github.com/gorilla/websocket"
)

type Client struct {
	roomID   string
	username string
	conn     *websocket.Conn
	send     chan []byte
}

func readPump(hub *hub, cl *Client) {
	for {
		_, data, err := cl.conn.ReadMessage()
		if err != nil {
			hub.unregister <- cl
			return
		}
		msg := &Message{
			Type:      "message",
			Username:  cl.username,
			Text:      string(data),
			Timestamp: time.Now(),
		}

		//history := hub.rooms[cl.roomID].msgHistory

		jsonMsg, err := json.Marshal(msg)

		if err != nil {
			fmt.Println("JSON parse error: ", err)
			return
		}

		broadcastMsg := Broadcast{
			roomID: cl.roomID,
			data:   jsonMsg,
			msg:    msg,
		}

		hub.broadcast <- broadcastMsg
	}
}

func writePump(cl *Client) {
	defer cl.conn.Close()
	for message := range cl.send {
		err := cl.conn.WriteMessage(websocket.TextMessage, message)
		if err != nil {
			fmt.Println("WritePumpErr: ", err)
			return
		}
	}
}
