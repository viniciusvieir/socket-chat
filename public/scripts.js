const username = prompt('What is your username?')

const socket = io('http://localhost:9000', {
  query: {
    username,
  },
})
let nsSocket

// When a client socket connects, the server will emit a message
// with the namespaces data
socket.on('namespacesData', (namespaces) => {
  // Update the DOM
  const namespacesDiv = document.querySelector('.namespaces')
  namespacesDiv.innerHTML = ''
  namespaces.forEach((ns) => {
    namespacesDiv.innerHTML += `<div class="namespace" ns=${ns.endpoint}><img src="${ns.img}"/></div>`
  })

  // Add a click listener to each namespace
  Array.from(document.getElementsByClassName('namespace')).forEach((elem) => {
    elem.addEventListener('click', (e) => {
      const endpoint = elem.getAttribute('ns')
      getRoomsInformation(endpoint)
    })
  })
})

// Get namespace' rooms information after the namespace info is retrieved
function getRoomsInformation(endpoint) {
  // Close existing connections and event listeners to the submit handler
  // so it doesn't submit messages multiple times after a new namespace
  // is selected.
  if (nsSocket) {
    nsSocket.close()
    document
      .querySelector('#user-input')
      .removeEventListener('submit', formSubmition)
  }

  nsSocket = io(`http://localhost:9000${endpoint}`)
  nsSocket.on('nsRooms', (nsRooms) => {
    // Update the DOM with the namespace's rooms information
    const roomsDiv = document.querySelector('.room-list')
    roomsDiv.innerHTML = ''
    nsRooms.forEach((room) => {
      const gliph = room.privateRoom ? 'lock' : 'globe'
      roomsDiv.innerHTML += `<li class="room"><span class="glyphicon glyphicon-${gliph}"></span>${room.roomTitle}</li>`
    })

    // Add a click listener to each room
    Array.from(document.getElementsByClassName('room')).forEach((elem) => {
      elem.addEventListener('click', (e) => {
        getRoomChatInformation(e.target.innerText)
      })
    })

    // Add user to the first room automatically
    getRoomChatInformation(nsRooms[0].roomTitle)
  })

  nsSocket.on('message', (msg) => {
    document.querySelector('#messages').innerHTML += messageHtml(msg)
  })

  document
    .querySelector('.message-form')
    .addEventListener('submit', formSubmition)
}

function getRoomChatInformation(roomTitle) {
  // This socket will send the server a message asking to join the room,
  // the callback will update the amount of clients connected to that room
  // after the server has completed the request (ACK)
  nsSocket.emit('askToJoinRoom', roomTitle, (clients) => {
    // update the amount of clients connected to the room
    // document.querySelector(
    //   '.curr-room-num-users'
    // ).innerHTML = `${clients} <span class="glyphicon glyphicon-user"></span
    // ></span>`
  })

  // When the server sucessfully joins the client socket to a room, it will
  // emit a message with the room chat history.
  nsSocket.on('roomHistory', (history) => {
    document.querySelector('.curr-room-text').innerText = roomTitle
    const messagesDiv = document.querySelector('#messages')
    messagesDiv.innerHTML = ''
    history.forEach((msg) => {
      messagesDiv.innerHTML += messageHtml(msg)
    })
    messagesDiv.scrollTo(0, messagesDiv.scrollHeight)
  })

  // This socket will update the number of connected clients when the server emits
  // the message bellow
  nsSocket.on('usersConnected', (clients) => {
    // update the amount of clients connected to the room
    document.querySelector(
      '.curr-room-num-users'
    ).innerHTML = `${clients} <span class="glyphicon glyphicon-user"></span
    ></span>`
  })
}

const messageHtml = (msg) => {
  return `
  <li>
    <div class="user-image">
      <img src="${msg.avatar}" />
    </div>
    <div class="user-message">
      <div class="user-name-time">${msg.username} <span>${new Date(
    msg.time
  ).toLocaleString()}</span></div>
      <div class="message-text">${msg.text}</div>
    </div>
  </li>
  `
}

const formSubmition = (event) => {
  event.preventDefault()
  const newMessage = document.querySelector('#user-message').value
  nsSocket.emit('newMessage', { text: newMessage })
}
