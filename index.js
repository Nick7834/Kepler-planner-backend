import express from 'express'
import mongoose from 'mongoose'
import multer from 'multer';

import { registerValidation, loginValidation } from './validations/validations.js';
import { handleValidationErrors, checkAuth }from './utils/index.js';
import { UseController, TaskController, FolderController } from './controllers/index.js';
import cors from 'cors';
import fs from 'fs';
import User from './modules/User.js';
import rateLimit from 'express-rate-limit'; import dotenv from 'dotenv';

dotenv.config();

// db 

mongoose.connect(
    process.env.MONGODB_URL,
).then(() => console.log('DB OK'))
.catch((err) => console.log('DB error', err));

const app = express();
app.use(cors());
app.use(express.json());
app.use('/backgrounds', express.static('backgrounds'));
app.use('/avatars', express.static('avatars'));

const readLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 минута
  max: 150, // до 120 запросов в минуту
  message: "Слишком много запросов, попробуйте позже."
});

// Лимит для изменения данных
const modifyLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 минута
  max: 100, // до 60 запросов в минуту
  message: "Слишком много запросов, попробуйте позже."
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
      cb(null, 'avatars');
  },
  filename: (req, file, cb) => {
      cb(null, `${Date.now()}_${file.originalname}`);
  }
});

const upload = multer({ storage });

app.patch('/upload-avatar', checkAuth, upload.single('avatar'), async (req, res) => {
  try {
      const userId = req.userId;
      const avatarUrl = `/avatars/${req.file.filename}`;

      const user = await User.findByIdAndUpdate(userId, { avatarUrl }, { new: true });

      if (!user) {
          res.status(404).send('Пользователь не найден');
      } else {
          res.send({ message: 'Аватар успешно обновлён', avatarUrl: user.avatarUrl });
      }
  } catch (err) {
      res.status(500).send('Ошибка при загрузке аватара');
  }
});

app.get('/backgrounds', checkAuth, function(req, res) {
    fs.readdir('backgrounds/', function(err, files) {
      if (err) {
        res.status(500).send('Не удалось загрузить изображения');
      } else {
        res.json(files.map(file => `/backgrounds/${file}`));
      }
    });
});

app.patch('/select-background', checkAuth, async function(req, res) {
  const userId = req.body.userId;
  const backgroundImage = req.body.backgroundImage;

  try {
    const user = await User.findByIdAndUpdate(userId, { backgroundImage: backgroundImage }, { new: true });
    if (!user) {
      res.status(404).send('Пользователь не найден');
    } else {
      res.send({ message: 'Фон успешно обновлён', backgroundImage: user.backgroundImage });
    }
  } catch (err) {
    res.status(500).send('Ошибка при обновлении фона пользователя');
  }
});

// autch

app.post('/auth/login', loginValidation, handleValidationErrors, UseController.login);
app.post('/auth/register', registerValidation, handleValidationErrors, UseController.register);
app.get('/auth/me', checkAuth, UseController.getMe);

// app

app.post('/tasks/today', checkAuth, modifyLimiter, FolderController.createTodayTask); 
app.post('/tasks', checkAuth, modifyLimiter, FolderController.createTask);
app.post('/tasks/today/add', checkAuth, modifyLimiter, FolderController.addExistingTaskToToday); 
app.post('/tasks/week', checkAuth, modifyLimiter, FolderController.createTaskForDayOfWeek); 
app.post('/folders', checkAuth, modifyLimiter, FolderController.createFolder); 
app.post('/folders/:folderId/tasks', checkAuth, modifyLimiter, FolderController.createTaskInFolder); 

app.get('/tasks/:taskId', checkAuth, readLimiter, FolderController.getTaskById);
app.get('/folders/:folderId', checkAuth, readLimiter, FolderController.getFolderById);
app.get('/allFolders', checkAuth, readLimiter, FolderController.getAllFolders);
app.get('/weekdays', checkAuth, readLimiter, FolderController.getAllWeekDays); 
app.get('/tasks/today/all', checkAuth, readLimiter, FolderController.allTasksToday);
app.get('/tasks', checkAuth, readLimiter, FolderController.allTasks); 
app.get('/alltasks/search', checkAuth, readLimiter, FolderController.searchTasks);

app.patch('/tasks/:taskId', checkAuth, modifyLimiter, FolderController.updateTask); 
app.patch('/folders/:folderId', checkAuth, modifyLimiter, FolderController.updateFolder); 

app.delete('/tasks/:taskId', checkAuth, modifyLimiter, FolderController.deleteTask); 
app.delete('/folders/:folderId', checkAuth, modifyLimiter, FolderController.deleteFolder); 
app.delete('/tasks/today/remove/:taskId', checkAuth, modifyLimiter, FolderController.removeTaskFromToday);

// host

app.listen(process.env.PORT || 5555, (err) => {
    if(err) {
        return console.log('ERR')
    } 

    console.log('SERVER OK')
})