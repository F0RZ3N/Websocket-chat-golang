package main

import (
	"encoding/json/v2"
	"fmt"
	"time"
)

type Room struct {
	msgHistory []Message
	clients    map[*Client]bool
}

type hub struct {
	rooms      map[string]*Room
	broadcast  chan Broadcast
	register   chan *Client
	unregister chan *Client
}

func newHub() *hub {
	h := &hub{
		rooms:      make(map[string]*Room),
		broadcast:  make(chan Broadcast, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
	return h
}

func (h *hub) Run() {
	fmt.Println("Hub running..\n")
	for {
		select {

		case regClient := <-h.register:
			room, ok := h.rooms[regClient.roomID]
			if !ok {
				room = &Room{
					clients: make(map[*Client]bool),
				}
				h.rooms[regClient.roomID] = room
			}
			room.clients[regClient] = true

			for _, message := range h.rooms[regClient.roomID].msgHistory {
				jsonMsg, err := json.Marshal(message)
				if err != nil {
					fmt.Println("JSON parse error: ", err)
				}
				regClient.send <- jsonMsg
			}

			msg := &Message{
				Type:      "system",
				Username:  regClient.username,
				Text:      fmt.Sprintln("User", regClient.username, "has joined the room"),
				Timestamp: time.Now(),
			}

			jsonMsg, err := json.Marshal(msg)
			if err != nil {
				fmt.Println("JSON parse error: ", err)
			}

			castJoined := &Broadcast{
				roomID: regClient.roomID,
				data:   jsonMsg,
				msg:    msg,
			}
			h.broadcast <- *castJoined

		case unregClient := <-h.unregister:
			room, ok := h.rooms[unregClient.roomID]
			if !ok {
				continue
			}
			if _, here := room.clients[unregClient]; here {
				delete(room.clients, unregClient)
				close(unregClient.send)
			}
			if len(room.clients) == 0 {
				delete(h.rooms, unregClient.roomID)
			}

		case gotBroadcast := <-h.broadcast:
			room, ok := h.rooms[gotBroadcast.roomID]
			if !ok {
				continue
			}
			for client := range room.clients {
				client.send <- gotBroadcast.data
			}
			if len(room.msgHistory) >= 50 {
				room.msgHistory = append(room.msgHistory[1:], *gotBroadcast.msg)
			} else {
				room.msgHistory = append(room.msgHistory, *gotBroadcast.msg)
			}
		}
	}
}
