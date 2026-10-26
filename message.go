package main

import "time"

type Message struct {
	Type      string    `json:"type"` // msg|system
	Username  string    `json:"username"`
	Text      string    `json:"text"`
	Timestamp time.Time `json:"timestamp"`
}

type Broadcast struct {
	roomID string
	data   []byte
	msg    *Message
}
