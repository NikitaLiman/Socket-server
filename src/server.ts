import { PrismaClient } from "@prisma/client";
import { Server } from "socket.io";
import http from "http";
import express from "express";
import cors from "cors";

const prisma = new PrismaClient();
const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const connectedUsers = new Map();

io.on("connection", (socket) => {
  console.log("user connected", socket.id);

  socket.on("userOnline", async (userId) => {
    console.log("userOnline", userId);
    connectedUsers.set(userId, socket.id);

    await prisma.userStatus.upsert({
      where: { userId: Number(userId) },
      update: { isOnline: true },
      create: { userId: Number(userId), isOnline: true },
    });

    const userStatus = await prisma.userStatus.findUnique({
      where: { userId: Number(userId) },
    });

    if (userStatus) {
      console.log("👋 Эмитим userStatusUpdate", {
        userId,
        isOnline: userStatus.isOnline,
        lastSeen: userStatus.lastSeen,
      });

      socket.broadcast.emit("userStatusUpdate", {
        userId,
        isOnline: userStatus.isOnline,
        lastSeen: userStatus.lastSeen,
      });
    }
  });

  socket.on("joinChat", async (chatId) => {
    console.log("Received joinChat event with chatId:", chatId);

    if (!chatId) {
      console.log("Error: chatId is null or undefined");
      return;
    }

    socket.join(chatId.toString());
    console.log(`User ${socket.id} joined chat ${chatId}`);

    try {
      const messages = await prisma.message.findMany({
        where: { chatId: parseInt(chatId) },
        orderBy: { id: "asc" },
      });
      socket.emit("oldMessages", messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  });

  socket.on("message", async (data) => {
    const { chatId, senderId, text, replyToId } = data;
    console.log("Received message on server:", data);

    try {
      const message = await prisma.message.create({
        data: {
          text,
          chatId: parseInt(chatId),
          senderId: parseInt(senderId),
          replyToId: replyToId ? parseInt(replyToId) : null,
        },
        include: {
          sender: true,
          replyTo: {
            include: {
              sender: true,
            },
          },
        },
      });
      socket.to(chatId.toString()).emit("newMessage", message);
      socket.emit("message", message);
      console.log(message);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  });

  socket.on("messageDeleted", async (data) => {
    const { messageId, chatId } = data;

    console.log("Received deleteMessage event with messageId:", messageId);

    if (!messageId || !chatId) {
      console.log("Error: messageId or chatId is null or undefined");
      return;
    }

    try {
      await prisma.message.delete({
        where: { id: Number(messageId) },
      });

      socket.to(chatId.toString()).emit("messageDeleted", messageId);

      console.log(`Message with ID ${messageId} deleted successfully`);
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  });

  socket.on("disconnect", async () => {
    const userId = [...connectedUsers.entries()].find(
      ([, id]) => id === socket.id
    )?.[0];

    if (userId) {
      connectedUsers.delete(userId);

      await prisma.userStatus.update({
        where: { userId: Number(userId) },
        data: {
          isOnline: false,
          lastSeen: new Date(),
        },
      });
      console.log("👋 Пользователь отключился:", userId);
      socket.broadcast.emit("userStatusUpdate", {
        userId,
        isOnline: false,
        lastSeen: new Date(),
      });
    }

    console.log("User disconnected:", socket.id);
  });
});

server.listen(3001, () => {
  console.log("Socket.IO server running on port 3001");
});
