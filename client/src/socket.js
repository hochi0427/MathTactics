import { io } from 'socket.io-client'

const socketUrl =
  window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : window.location.origin

const socket = io(socketUrl)

export default socket