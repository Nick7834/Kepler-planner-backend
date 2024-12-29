import User from '../modules/User.js';
import mongoose from 'mongoose';
const { ObjectId } = mongoose.Types;

import moment from 'moment-timezone';

const getTimezoneFromIP = (ip) => {
    return 'Europe/Moscow'; 
};

export const createTodayTask = async (req, res) => {
    try {
        const { title } = req.body;
        const userId = req.userId;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        const userTimezone = getTimezoneFromIP(req.ip); // Получаем временную зону пользователя по IP

        const taskId = new ObjectId();
        // Получаем текущее время в соответствии с временной зоной пользователя
        const nowInUserTime = moment().tz(userTimezone); 

        // Создаем новую задачу
        const newTask = {
            _id: taskId, // Генерируем уникальный ObjectId
            title,
            done: false,
            pin: false,
            folder: user.folders[0].name,
            folderId: user.folders[0]._id,
            dueDate: nowInUserTime.toDate(), // Сохраняем время задачи по времени пользователя
        };

        user.folders[0].tasks.push(newTask);
        user.todayTasks.push(newTask);

        // Находим текущий день недели (0 - воскресенье, 1 - понедельник, ..., 6 - суббота)
        const currentDayOfWeek = nowInUserTime.day(); // Используем day из moment, чтобы получить день недели

        // Ищем или создаем объект задач для текущего дня недели
        let dayTasks = user.weekTasks.find(dayTask => dayTask.dayOfWeek === currentDayOfWeek);
        if (!dayTasks) {
            dayTasks = {
                dayOfWeek: currentDayOfWeek,
                tasks: []
            };
            user.weekTasks.push(dayTasks);
        }
        dayTasks.tasks.push(newTask);

        // Сохраняем обновленного пользователя
        await user.save();

        return res.json(newTask); // Отправляем созданную задачу
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Ошибка сервера' });
    }
};

export const createTask = async (req, res) => {
    try {
        const { title } = req.body;
        const userId = req.userId;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        const taskId = new ObjectId();

        // Получаем временную зону пользователя по IP (если использовать IP)
        const userTimezone = getTimezoneFromIP(req.ip); // Можно заменить на метод для получения по IP, например geoip

        // Получаем текущее время в локальной временной зоне пользователя
        const nowInUserTime = moment().tz(userTimezone);

        // Создаем новую задачу с учетом времени пользователя
        const newTask = {
            _id: taskId, // Генерируем уникальный ObjectId
            title,
            dueDate: nowInUserTime.toDate(), // Сохраняем дату в локальной временной зоне пользователя
            done: false,
            pin: false,
            folder: user.folders[0].name,
            folderId: user.folders[0]._id
        };

        user.folders[0].tasks.push(newTask);
        user.tasks.push(newTask); // Добавляем задачу в список всех задач пользователя

        // Сохраняем обновленного пользователя
        await user.save();

        return res.json(newTask); // Отправляем созданную задачу
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Ошибка сервера' });
    }
};

export const addExistingTaskToToday = async (req, res) => {
    try {
        const { taskId } = req.body; // Получаем ID задачи из тела запроса
        const userId = req.userId;

        // Поиск пользователя по ID
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        // Получаем временную зону пользователя по IP
        const userTimezone = getTimezoneFromIP(req.ip); // Применяем функцию getTimezoneFromIP

        // Поиск задачи среди всех задач пользователя
        let existingTask = null;
        let folderContainingTask = null;
        for (const folder of user.folders) {
            existingTask = folder.tasks.find(task => task._id.equals(taskId));
            if (existingTask) {
                folderContainingTask = folder;
                break;
            }
        }

        if (!existingTask) {
            return res.status(404).json({ message: 'Задача не найдена' });
        }

        // Проверяем, не добавлена ли уже задача в список на сегодня
        const isAlreadyAdded = user.todayTasks.some(task => task._id.equals(taskId));
        if (isAlreadyAdded) {
            return res.status(400).json({ message: 'Задача уже добавлена на сегодня' });
        }

        // Обновляем дату выполнения задачи с учетом временной зоны пользователя
        existingTask.dueDate = moment().tz(userTimezone).toDate(); // Устанавливаем время с учетом временной зоны

        // Добавляем задачу в список на сегодня
        user.todayTasks.push(existingTask);

        // Если задача также хранится в одной из папок, обновляем ее там
        if (folderContainingTask) {
            const taskIndex = folderContainingTask.tasks.findIndex(task => task._id.equals(taskId));
            folderContainingTask.tasks[taskIndex].dueDate = existingTask.dueDate;
        }

        // Сохраняем изменения в модели пользователя
        await user.save();

        return res.json({ message: 'Задача добавлена и обновлена в список на сегодня', task: existingTask });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Ошибка сервера' });
    }
};

export const removeTaskFromToday = async (req, res) => {
    try {
        const { taskId } = req.params; // Получаем ID задачи из параметров маршрута
        const userId = req.userId;

        // Поиск пользователя по ID
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        // Находим и удаляем задачу из списка задач на сегодня
        const initialCount = user.todayTasks.length;
        user.todayTasks = user.todayTasks.filter(task => !task._id.equals(taskId));

        if (user.todayTasks.length === initialCount) {
            // Если длина массива не изменилась, задача не была найдена
            return res.status(404).json({ message: 'Задача не найдена в списке на сегодня' });
        }

        // Сохраняем изменения в модели пользователя
        await user.save();

        return res.status(204).send(); // HTTP 204 No Content для успешного удаления без тела ответа
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Ошибка сервера' });
    }
};

export const allTasksToday = async (req, res) => {
    try {
        const userId = req.userId;

        // Поиск пользователя по ID
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        // Получаем временную зону пользователя
        const userTimezone = getTimezoneFromIP(req.ip);  // можно заменить на функцию получения временной зоны пользователя, если она есть

        const today = moment().tz(userTimezone).startOf('day'); // Начало дня в часовой зоне пользователя
        const todayString = today.format('YYYY-MM-DD'); // Форматируем как строку, чтобы можно было сравнить

        // Фильтруем задачи, чтобы оставить только те, которые соответствуют текущему дню
        const tasksForTodayOnly = user.todayTasks.filter(task => {
            const taskDueDate = moment(task.dueDate).tz(userTimezone).startOf('day');
            return taskDueDate.format('YYYY-MM-DD') === todayString;
        });

        // Обновляем список задач на сегодня, если он изменился
        if (user.todayTasks.length !== tasksForTodayOnly.length) {
            user.todayTasks = tasksForTodayOnly;
            await user.save(); // сохраняем изменения в документе пользователя
        }

        // Возвращаем список задач, которые точно соответствуют текущей дате
        return res.json(tasksForTodayOnly);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Ошибка сервера' });
    }
};

export const createTaskForDayOfWeek = async (req, res) => {
    try {
        const { title, dayOfWeek } = req.body;
        const userId = req.userId;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        if (typeof dayOfWeek !== 'number' || dayOfWeek < 0 || dayOfWeek > 6) {
            return res.status(400).json({ message: 'Invalid day of the week. It must be a number between 0 (Sunday) and 6 (Saturday).' });
        }

        const userTimezone = getTimezoneFromIP(req.ip); // Получаем временную зону пользователя

        const getNextDayOfWeek = (dayOfWeek, userTimezone) => {
            const today = moment().tz(userTimezone).startOf('day'); // Устанавливаем начало текущего дня по времени пользователя
            const currentDayOfWeek = today.day(); // Получаем день недели по времени пользователя

            let daysToAdd = dayOfWeek - currentDayOfWeek;
            if (daysToAdd < 0) {
                daysToAdd += 7; // Если выбранный день уже прошел в этой неделе, добавляем 7 дней
            }
        
            const nextDate = today.add(daysToAdd, 'days');
            return nextDate;
        };

        const newTask = {
            _id: new ObjectId(),
            title,
            dueDate: getNextDayOfWeek(dayOfWeek, userTimezone).toDate(), // Используем вычисленный момент с учетом временной зоны
            done: false,
            pin: false,
            folder: user.folders[0].name,
            folderId:  user.folders[0]._id
        };

        user.folders[0].tasks.push(newTask);

        let dayTasks = user.weekTasks.find(dayTask => dayTask.dayOfWeek === dayOfWeek);
        if (!dayTasks) {
            dayTasks = {
                dayOfWeek,
                tasks: []
            };
            user.weekTasks.push(dayTasks);
        }
        dayTasks.tasks.push(newTask);

        await user.save();

        return res.json(newTask);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Ошибка сервера' });
    }
};

export const getAllWeekDays = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        const userTimezone = getTimezoneFromIP(req.ip); // Получаем временную зону пользователя

        const today = moment().tz(userTimezone).startOf('day'); // Начало текущего дня по времени пользователя

        const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        let weekDays = [];

        for (let i = 0; i < 7; i++) {
            const dayDate = today.clone().add(i, 'days'); // Клонируем объект today и добавляем дни
            weekDays.push({
                dayOfWeek: daysOfWeek[dayDate.day()],
                dayIndex: dayDate.day(),
                tasks: []
            });
        }

        // Добавление задач в соответствующие дни
        user.weekTasks.forEach(weekTask => {
            weekTask.tasks.forEach(task => {
                const taskDate = moment(task.dueDate).tz(userTimezone).startOf('day'); // Преобразуем dueDate в момент времени с учетом временной зоны пользователя
                const diff = taskDate.diff(today, 'days'); // Разница в днях

                if (diff >= 0 && diff < 7) {
                    weekDays[diff].tasks.push(task);
                }
            });
        });

        await user.save(); // Сохраняем изменения в базе данных

        return res.json(weekDays);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Ошибка сервера' });
    }
};

export const createFolder = async (req, res) => {
    try {
        const { name, description } = req.body;
        const userId = req.userId;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        user.folders.push({
            name,
        });
        await user.save();

        return res.json(user.folders[user.folders.length - 1]); // Отправляем созданную папку
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Ошибка сервера' });
    }
};

export const getAllFolders = async (req, res) => {
    try {
        const userId = req.userId; // Получаем идентификатор пользователя из запроса
        const user = await User.findById(userId); // Находим пользователя по его идентификатору

        // Проверяем, был ли найден пользователь
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        // Возвращаем массив всех папок пользователя с информацией о папках и их задачах
        const foldersWithTasks = user.folders.map(folder => ({
            ...folder.toObject(),
            tasks: folder.tasks.map(task => ({
                ...task.toObject(),
                folder: folder.name,
                folderId: folder._id // Добавляем информацию о папке к каждой задаче
            }))
        }));

        return res.json(foldersWithTasks);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Ошибка сервера' });
    }
};

export const createTaskInFolder = async (req, res) => {
    try {
        const { title, dueDate } = req.body;
        const userId = req.userId;
        const folderId = req.params.folderId; // Идентификатор папки

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        const folder = user.folders.id(folderId);
        if (!folder) {
            return res.status(404).json({ message: 'Папка не найдена' });
        }

        // Получаем временную зону пользователя по IP
        const userTimezone = getTimezoneFromIP(req.ip); // Применяем функцию getTimezoneFromIP

        // Генерируем уникальный ObjectId для новой задачи
        const taskId = new ObjectId();

        // Создаем новую задачу с указанием папки и временной зоны для dueDate
        const newTask = {
            _id: taskId,
            title,
            dueDate: dueDate ? moment(dueDate).tz(userTimezone).toDate() : moment().tz(userTimezone).toDate(), // Устанавливаем дату с учетом временной зоны
            done: false,
            folder: folder.name, // Название папки
            folderId: folder._id,
            pin: false
        };

        // Добавляем задачу в список задач папки
        folder.tasks.push(newTask);

        // Сохраняем обновленного пользователя
        await user.save();

        return res.json(newTask); // Отправляем созданную задачу внутри папки
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Ошибка сервера' });
    }
};

export const getTaskById = async (req, res) => {
    try {
        const userId = req.userId;
        const taskId = req.params.taskId;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        // Поиск задачи в общем списке задач пользователя
        const taskInUserTasks = user.tasks.id(taskId);

        // Поиск задачи в папках пользователя
        let taskInFolders = null;
        let folderName = null;
        let folderId = null;
        user.folders.forEach(folder => {
            const task = folder.tasks.id(taskId);
            if (task) {
                taskInFolders = task;
                folderName = folder.name;
                folderId = folder._id;
            }
        });

        // Поиск задачи в массиве todayTasks
        const taskInTodayTasks = user.todayTasks.id(taskId);

        // Если задача найдена в одном из списков, возвращаем её
        const foundTask = taskInUserTasks || taskInFolders || taskInTodayTasks;
        if (foundTask) {
            const taskInfo = foundTask.toObject();
            if (folderName) {
                taskInfo.folder = folderName;
                taskInfo.folderId = folderId;
            }
            // Если задача из todayTasks, добавим специальную метку
            if (taskInTodayTasks) {
                taskInfo.isTodayTask = true; // Маркер, указывающий, что задача из списка todayTasks
            }
            return res.json(taskInfo);
        } else {
            // Если задача не найдена ни в одном из списков, возвращаем ошибку
            return res.status(404).json({ message: 'Задача не найдена' });
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Ошибка сервера' });
    }
};

export const getFolderById = async (req, res) => {
    try {
        const userId = req.userId;
        const folderId = req.params.folderId;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        // Находим папку по ее идентификатору
        const folder = user.folders.id(folderId);
        if (!folder) {
            return res.status(404).json({ message: 'Папка не найдена' });
        }

        // Получаем задачи в этой папке с информацией о папке
        const tasksInFolder = folder.tasks.map(task => ({
            ...task.toObject(),
            folder: folder.name,
            folderIds: folder._id // Добавляем информацию о папке к каждой задаче
        }));

        // Возвращаем информацию о папке с задачами
        return res.json({
                ...folder.toObject(), // Преобразуем папку в объект
                tasks: tasksInFolder // Добавляем задачи с информацией о папке
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Ошибка сервера' });
    }
};

export const updateTask = async (req, res) => {
    try {
        const userId = req.userId;
        const taskId = req.params.taskId;
        const { title, dueDate, done, pin } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        let taskUpdated = false;
        let updatedTask = null;  // Добавлено для хранения обновленной задачи

        const userTimezone = getTimezoneFromIP(req.ip); // Получаем временную зону пользователя

        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (dueDate !== undefined) updateData.dueDate = moment(dueDate).tz(userTimezone).toDate(); // Устанавливаем дату с учетом временной зоны
        if (done !== undefined) updateData.done = done;
        if (pin !== undefined) updateData.pin = pin;

        const updateTaskFields = (task) => {
            if (task) {
                task.set(updateData);
                taskUpdated = true;
                updatedTask = task;  // Сохраняем ссылку на обновленную задачу
            }
        };

        // Обновляем задачу в основном списке задач пользователя
        updateTaskFields(user.tasks.id(taskId));
        
        // Обновляем задачу в папках
        user.folders.forEach(folder => {
            updateTaskFields(folder.tasks.id(taskId));
        });

        // Обновляем задачу в списке задач на неделю
        user.weekTasks.forEach(weekTask => {
            weekTask.tasks.forEach(task => {
                if (task._id.equals(taskId)) {
                    updateTaskFields(task);
                }
            });
        });

        // Обновляем задачу в списке задач на сегодня
        updateTaskFields(user.todayTasks.id(taskId));

        // Сохраняем изменения в модели пользователя
        await user.save();

        if (taskUpdated) {
            return res.json(updatedTask);  // Возвращаем полные данные обновленной задачи
        } else {
            return res.status(404).json({ message: 'Задача не найдена' });
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Ошибка сервера' });
    }
};

export const updateFolder = async (req, res) => {
    try {
        const userId = req.userId;
        const folderId = req.params.folderId;
        const { name } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        const folder = user.folders.id(folderId);
        if (!folder) {
            return res.status(404).json({ message: 'Папка не найдена' });
        }

        // Обновляем имя папки
        folder.name = name;

        // Обновляем имя папки в задачах
        user.tasks.forEach(task => {
            if (task.folderId && task.folderId.toString() === folderId) {
                task.folder = name;
            }
        });

        // Обновляем имя папки в todayTasks
        user.todayTasks.forEach(task => {
            if (task.folderId && task.folderId.toString() === folderId) {
                task.folder = name;
            }
        });

        // Обновляем имя папки в weekTasks
        user.weekTasks.forEach(dayTasks => {
            if (Array.isArray(dayTasks.tasks)) {
                dayTasks.tasks.forEach(task => {
                    if (task.folderId && task.folderId.toString() === folderId) {
                        task.folder = name;
                    }
                });
            }
        });

        // Обновляем имя папки внутри задач, находящихся в самой папке
        folder.tasks.forEach(task => {
            task.folder = name;
        });

        await user.save();

        return res.json(folder); // Отправляем обновленную папку
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Ошибка сервера' });
    }
};

export const allTasks = async (req, res) => {
    try {
        const userId = req.userId;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        // Собираем все задачи из папок с информацией о папках
        const tasksWithFolders = [];

        // Задачи из папок с указанием папок
        user.folders.forEach(folder => {
            const tasksInFolder = folder.tasks.map(task => {
                return {
                    ...task.toObject(),
                    folder: folder.name, 
                    folderId: folder._id// Папка, в которой находится задача
                };
            });
            tasksWithFolders.push(...tasksInFolder);
        });

        return res.json(tasksWithFolders);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Ошибка сервера' });
    }
};

export const deleteTask = async (req, res) => {
    try {
        const userId = req.userId;
        const taskId = req.params.taskId;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        // Проверяем наличие задачи в списке задач по дням недели
        if (user.weekTasks && user.weekTasks.length > 0) {
            user.weekTasks.forEach(dayTask => {
                dayTask.tasks = dayTask.tasks.filter(task => !task._id.equals(taskId));
            });
        }

        // Проверяем наличие задачи в общем списке задач пользователя
        const taskInUserTasks = user.tasks.id(taskId);
        const todayTask = user.todayTasks.id(taskId)

        // Проверяем наличие задачи в папках пользователя
        let taskInFolders = null;
        user.folders.forEach(folder => {
            if (folder.tasks.some(task => task._id.equals(taskId))) {
                taskInFolders = folder;
            }
        });

        // Если задача не найдена ни в одной папке и в общем списке задач, возвращаем ошибку
        if (!taskInUserTasks && !taskInFolders && !todayTask) {
            return res.status(404).json({ message: 'Задача не найдена' });
        }

        // Удаляем задачу из общего списка задач пользователя
        if (taskInUserTasks) {
            user.tasks.pull(taskId);
        }

        if (todayTask) {
            user.todayTasks.pull(taskId);
        }

        // Удаляем задачу из папки, если она была найдена
        if (taskInFolders) {
            taskInFolders.tasks = taskInFolders.tasks.filter(task => !task._id.equals(taskId));
        }

        // Сохраняем обновленного пользователя
        await user.save();

        // Отправляем ответ с данными об удаленной задаче
        return res.json({ message: 'Задача успешно удалена', deletedTaskId: taskId });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Ошибка сервера' });
    }
};

export const deleteFolder = async (req, res) => {
    try {
        const userId = req.userId;
        const folderId = req.params.folderId;

        // Находим пользователя по ID
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        // Находим папку, которую нужно удалить
        const folder = user.folders.id(folderId);

        // Проверяем, если папка имеет поле importance: 'importance', то её удалять нельзя
        if (folder && folder.importance === 'importance') {
            return res.status(400).json({ message: 'Эту папку нельзя удалить' });
        }

        // Если папка не найдена
        if (!folder) {
            return res.status(404).json({ message: 'Папка не найдена' });
        }

        // Получаем список задач в удаляемой папке
        const tasksInFolder = folder.tasks.map(task => task._id.toString());

        // Удаляем задачи из списка всех задач пользователя
        user.tasks = user.tasks.filter(task => !tasksInFolder.includes(task._id.toString()));

        // Удаляем задачи из списка задач на сегодня
        user.todayTasks = user.todayTasks.filter(task => !tasksInFolder.includes(task._id.toString()));

        // Удаляем задачи из списка задач на неделю
        user.weekTasks.forEach(weekTask => {
            weekTask.tasks = weekTask.tasks.filter(task => !tasksInFolder.includes(task._id.toString()));
        });

        // Удаляем саму папку
        user.folders = user.folders.filter(f => !f._id.equals(folderId));

        // Сохраняем изменения
        await user.save();

        return res.status(204).send(); // HTTP 204 No Content
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Ошибка сервера' });
    }
};

// search

export const searchTasks = async (req, res) => {
    try {
        const { query } = req.query;
        const userId = req.userId;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        // Функция для проверки совпадения названия задачи с запросом
        const matchTitle = task => task.title && task.title.toLowerCase().includes(query.toLowerCase());

        // Создаем множество для хранения уникальных ID задач
        const uniqueTaskIds = new Set();

        // Функция для добавления задачи в массив только если ее ID уникален
        const addUniqueTask = (task, allTasks) => {
            if (!uniqueTaskIds.has(task._id.toString())) {
                allTasks.push(task);
                uniqueTaskIds.add(task._id.toString());
            }
        };

        // Поиск всех задач пользователя, которые соответствуют запросу
        const allTasks = [];

        // Поиск задач в списке задач на сегодня
        user.todayTasks.forEach(task => {
            if (matchTitle(task)) addUniqueTask(task, allTasks);
        });

        // Поиск задач в списках задач для каждого дня недели
        user.weekTasks.forEach(dayTasks => {
            dayTasks.tasks.forEach(task => {
                if (matchTitle(task)) addUniqueTask(task, allTasks);
            });
        });

        // Поиск задач в каждой папке пользователя
        user.folders.forEach(folder => {
            folder.tasks.forEach(task => {
                if (matchTitle(task)) addUniqueTask(task, allTasks);
            });
        });

        return res.json(allTasks);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Ошибка сервера' });
    }
};
