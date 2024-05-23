import mongoose from 'mongoose';

const { Schema } = mongoose;

const TaskSchema = new Schema({
    title: {
        type: String,
        required: true,
    },
    done: {
        type: Boolean,
        default: false,
    },
    pin: {
        type: Boolean,
        default: false,
    },
    folder: String,
    folderId: String,
    dueDate: Date,
});

const FolderSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    importance: {
        type: String,
        enum: ['importance'],
    },
    tasks: [TaskSchema]
});

const personalFolder = {
    name: 'Personal',
    importance: 'importance',
    tasks: []
};

const UserSchema = new Schema({
    fullName: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    passwordHash: {
        type: String,
        required: true,
    },
    avatarUrl: {
        type: String,
        default: '/avatars/avatar-cacti-cactus-svgrepo-com.png'
    },
    backgroundImage: {
        type: String,
        default: '/backgrounds/eight.jpg'
    },
    folders: {
        type: [FolderSchema],
        default: [personalFolder],
    },
    tasks: [TaskSchema],
    todayTasks: [TaskSchema],
    weekTasks: {
        type: [{
            dayOfWeek: Number,
            tasks: [TaskSchema],
        }],
        default: [
            { dayOfWeek: 0, tasks: [] },
            { dayOfWeek: 1, tasks: [] },
            { dayOfWeek: 2, tasks: [] },
            { dayOfWeek: 3, tasks: [] },
            { dayOfWeek: 4, tasks: [] },
            { dayOfWeek: 5, tasks: [] },
            { dayOfWeek: 6, tasks: [] },
        ],
    },
}, {
    timestamps: true
});


const User = mongoose.model('User', UserSchema);

export default User;
