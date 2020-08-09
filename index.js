const express = require('express')
const app = express()

app.use(express.static(__dirname + '/public'))

const server = app.listen(9000, () => console.log('listening on port 9000...'))

const io = require('socket.io')(server)

const namespaces = require('./data/namespaces')
const { emit } = require('nodemon')

io.on('connection', (socket) => {
  // Build an array to send back with the img and endpoint for each namespace
  const namespacesData = namespaces.map((ns) => ({
    img: ns.img,
    endpoint: ns.endpoint,
  }))
  // Send the namepsaces data back to the client. We need to use the variable socket,
  // NOT the variable io, because we want to send only to this socket and not all of them.
  socket.emit('namespacesData', namespacesData)
})

// Loop through every namespace and listen to a connection
namespaces.forEach((namespace) => applySocketConnectionFor(namespace))

function applySocketConnectionFor(namespace) {
  io.of(namespace.endpoint).on('connection', (nsSocket) => {
    const username = nsSocket.handshake.query.username
    console.log(username, 'has joined', namespace.endpoint)

    // After the client socket has connected to the namespace, send back information about the
    // namespace's rooms.
    nsSocket.emit('nsRooms', namespace.rooms)

    // When the client socket asks to join a room
    nsSocket.on('askToJoinRoom', (roomTitle, callback) => {
      // Before the server joins the socket to a room, we need to drop the sockets from all the
      // other rooms it is in (except the first one which is the private socket room).
      const oldRoom = Object.keys(nsSocket.rooms)[1]
      nsSocket.leave(oldRoom)
      updateNumberOfClientsInRoom(namespace.endpoint, oldRoom)

      nsSocket.join(roomTitle)
      updateNumberOfClientsInRoom(namespace.endpoint, roomTitle)

      // After a client socket joins a room, emit a message with the room history
      const room = namespace.rooms.find((room) => (room.roomTitle = roomTitle))
      nsSocket.emit('roomHistory', room.history)
    })

    // When a message is sent from the client socket, add it to memory
    nsSocket.on('newMessage', (messageData) => {
      const fullMessage = {
        text: messageData.text,
        time: Date.now(),
        username: username,
        avatar: 'https://via.placeholder.com/30',
      }
      // When a message is received from the client socket, save the message to memory and
      // emmit it to all the other sockets in the room. To find out what rooms the sockets
      // are in we can use sockets.rooms
      // IMPORTANT: the socket always joins its own room after a connection is established
      const roomTitle = Object.keys(nsSocket.rooms)[1]
      const room = namespace.rooms.find((room) => (room.roomTitle = roomTitle))
      room.addMessage(fullMessage)
      io.of(namespace.endpoint).in(roomTitle).emit('message', fullMessage)
    })
  })
}

function updateNumberOfClientsInRoom(namespace, roomTitle) {
  // After a client socket joins a room, send the new number of clients connected
  // to all the clients sockets.
  io.of(namespace)
    .in(roomTitle)
    .clients((err, clients) => {
      // The client socket requesting to join the room would reveive the number of
      // sockets connected twice, once in the callback and another one in the emitter.
      // But I kept this here for educational purposes.
      // callback(clients.length)
      io.of(namespace.endpoint)
        .in(roomTitle)
        .emit('usersConnected', clients.length)
    })
}
