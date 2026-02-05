const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Room ID -> { desktopId?, phoneId? }
const rooms = new Map();

// Generate short room code (6 chars) for easy entry
function shortId() {
  return uuidv4().slice(0, 6);
}

// Get server URL for QR; use LAN IP so phone can connect, fallback to request host
function getServerUrl(req, port) {
  const lanHost = getLanHost();
  if (lanHost && port) return `http://${lanHost}:${port}`;
  const host = req.get('host') || req.hostname || 'localhost';
  const protocol = req.protocol || 'http';
  return `${protocol}://${host}`;
}

function getLanHost() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return null;
}

let serverPort = null;

// Create a new pairing room
app.post('/api/room', (req, res) => {
  const roomId = shortId();
  rooms.set(roomId, { desktopId: null, phoneId: null, createdAt: Date.now() });
  const baseUrl = getServerUrl(req, serverPort);
  res.json({
    roomId,
    pairingUrl: `${baseUrl}/pair/${roomId}`,
    wsUrl: baseUrl.replace(/^http/, 'ws'),
  });
});

// Get room info (for pairing page)
app.get('/api/room/:roomId', (req, res) => {
  const { roomId } = req.params;
  if (!rooms.has(roomId)) {
    return res.status(404).json({ error: 'Room not found' });
  }
  const baseUrl = getServerUrl(req, serverPort);
  res.json({
    roomId,
    pairingUrl: `${baseUrl}/pair/${roomId}`,
    wsUrl: baseUrl.replace(/^http/, 'ws'),
  });
});

// Serve pairing page with QR code (server-rendered); QR uses LAN IP + current port
app.get('/pair/:roomId', async (req, res) => {
  const { roomId } = req.params;
  const baseUrl = getServerUrl(req, serverPort);
  const connectUrl = `airmouse://connect?server=${encodeURIComponent(baseUrl)}&room=${encodeURIComponent(roomId)}`;
  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(connectUrl, { width: 220, margin: 1 });
  } catch (_) {}
  if (!qrDataUrl) qrDataUrl = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"/>';
  const htmlPath = path.join(__dirname, 'pair.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  html = html.replace('__ROOM_ID__', roomId).replace('__QR_DATA_URL__', qrDataUrl);
  res.type('html').send(html);
});

// Socket.IO: identity = 'desktop' | 'phone', roomId
io.on('connection', (socket) => {
  socket.on('join', ({ identity, roomId }) => {
    if (!roomId || !identity) {
      socket.emit('error', { message: 'Missing roomId or identity' });
      return;
    }
    let room = rooms.get(roomId);
    if (!room) {
      room = { desktopId: null, phoneId: null, createdAt: Date.now() };
      rooms.set(roomId, room);
    }
    socket.roomId = roomId;
    socket.identity = identity;
    socket.join(roomId);
    if (identity === 'desktop') {
      room.desktopId = socket.id;
    } else if (identity === 'phone') {
      room.phoneId = socket.id;
    }
    socket.emit('joined', { roomId, identity });
    if (room.desktopId && room.phoneId) {
      io.to(roomId).emit('paired', {});
    }
  });

  socket.on('mouse:move', (data) => {
    if (socket.identity !== 'phone') return;
    socket.to(socket.roomId).emit('mouse:move', data);
  });

  socket.on('mouse:click', (data) => {
    if (socket.identity !== 'phone') return;
    socket.to(socket.roomId).emit('mouse:click', data);
  });

  socket.on('mouse:scroll', (data) => {
    if (socket.identity !== 'phone') return;
    socket.to(socket.roomId).emit('mouse:scroll', data);
  });

  socket.on('disconnect', () => {
    const room = socket.roomId && rooms.get(socket.roomId);
    if (room) {
      if (socket.identity === 'desktop') room.desktopId = null;
      if (socket.identity === 'phone') room.phoneId = null;
    }
  });
});

// Clean up stale rooms every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    if (now - room.createdAt > 30 * 60 * 1000) rooms.delete(roomId);
  }
}, 5 * 60 * 1000);

// Random port in user range (avoid privileged and well-known), or use PORT env
function getRandomPort() {
  const min = 49152;
  const max = 65535;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : getRandomPort();
const urlFile = path.join(__dirname, '.airmouse-server-url');

server.listen(PORT, '0.0.0.0', () => {
  serverPort = PORT;
  const url = `http://0.0.0.0:${PORT}`;
  console.log(`Air Mouse server running at ${url}`);
  console.log(`Pairing page: http://localhost:${PORT}/pair/<roomId>`);
  console.log(`For desktop: AIRMOUSE_SERVER=http://localhost:${PORT}`);
  try {
    fs.writeFileSync(urlFile, url, 'utf8');
  } catch (_) {}
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is in use. Set PORT to another value or free the port.`);
  } else {
    console.error(e);
  }
  process.exit(1);
});
