import cloudinary from "../lib/cloudinary.js";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id; // Get the logged-in user's ID from the request
    const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }) // Find all users except the logged-in user
      .select("-password"); // Exclude password and version field
    res.status(200).json(filteredUsers); // Send the list of users as a response
  } catch (error) {
    console.error("Error fetching users for sidebar: ", error.message);
    res.status(500).send({ message: "Internal server error" });
  }
};

export const getMessages = async (req, res) => {
  const { id } = req.params; // Get the user ID from the request parameters
  try {
    const messages = await Message.find({
      $or: [
        { senderId: req.user._id, receiverId: id }, // Messages sent by the logged-in user to the specified user
        { senderId: id, receiverId: req.user._id }, // Messages sent by the specified user to the logged-in user
      ],
    }).sort({ createdAt: 1 }); // Sort messages by creation date in ascending order
    res.status(200).json(messages); // Send the messages as a response
  } catch (error) {
    console.error("Error fetching messages: ", error.message);
    res.status(500).send({ message: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  const { receiverId } = req.params; // Get the receiver's user ID from the request parameters
  const { text, image } = req.body; // Get the message content from the request body
  try {
    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }
    const newMessage = new Message({
      senderId: req.user._id, // Set the sender to the logged-in user's ID
      receiverId: receiverId, // Set the receiver to the specified user's ID
      text, // Set the message content
      image: imageUrl,
    });
    await newMessage.save(); // Save the new message to the database

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage); // Send the newly created message as a response
  } catch (error) {
    console.error("Error sending message: ", error.message);
    res.status(500).send({ message: "Internal server error" });
  }
};
