package main

import (
	"fmt"
)

type hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
}

func newHub() *hub {
	h := &hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte, 256),
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
			h.clients[regClient] = true
		case unregClient := <-h.unregister:
			if _, here := h.clients[unregClient]; here {
				delete(h.clients, unregClient)
				close(unregClient.send)
			}
		case gotBroadcast := <-h.broadcast:
			for client := range h.clients {
				client.send <- gotBroadcast
			}
		}
	}
}
