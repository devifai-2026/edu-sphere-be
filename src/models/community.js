import mongoose from 'mongoose';
import { publishableFields } from './publishable.js';

const { Schema, model } = mongoose;

const groupSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    icon: { type: String, default: 'people' },
    official: { type: Boolean, default: false }, // run by SpeedUp Infotech admin
    recommended: { type: Boolean, default: false }, // admin-curated recommendation group
    memberIds: { type: [Schema.Types.ObjectId], ref: 'User', default: [] }, // actual student members
    members: { type: Number, default: 0 }, // denormalized count
    lastMsg: { type: String, default: '' },
    ...publishableFields,
  },
  { timestamps: true }
);
export const Group = model('Group', groupSchema);

const chatMessageSchema = new Schema(
  {
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    senderName: { type: String, default: '' },
    fromAdmin: { type: Boolean, default: false }, // admin-posted (can include images)
    kind: { type: String, enum: ['text', 'image'], default: 'text' },
    text: { type: String, default: '' },
    imageUrl: { type: String, default: '' }, // only for admin image posts
    deleted: { type: Boolean, default: false }, // soft-delete by admin moderation
  },
  { timestamps: true }
);
export const ChatMessage = model('ChatMessage', chatMessageSchema);

const inviteSchema = new Schema(
  {
    fromUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    fromName: { type: String, default: '' },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', default: null },
    groupName: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
  },
  { timestamps: true }
);
export const Invite = model('Invite', inviteSchema);

/** Audit log of group join/leave events (timestamped). */
const membershipLogSchema = new Schema(
  {
    group: { type: Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
    groupName: { type: String, default: '' },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userName: { type: String, default: '' },
    action: { type: String, enum: ['join', 'leave'], required: true },
    by: { type: String, enum: ['user', 'admin'], default: 'user' }, // admin = removed by admin
  },
  { timestamps: true }
);
membershipLogSchema.index({ createdAt: -1 });
export const GroupMembershipLog = model('GroupMembershipLog', membershipLogSchema);
