import User from '../modules/User.js';

export const createTodayTask = async (req, res) => {
    try {
        const { title, description } = req.body;
        const userId = req.userId;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        user.tasks.push({
            title,
            description,
            dueDate: new Date(), // Задача на сегодня
        });
        await user.save();

        res.json(user.tasks[user.tasks.length - 1]); // Отправляем созданную задачу
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

export const createWeekTask = async (req, res) => {
    try {
        const { title, description, dueDate } = req.body;
        const userId = req.userId;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        user.tasks.push({
            title,
            description,
            dueDate: new Date(dueDate), // Задача на конкретную дату
        });
        await user.save();

        res.json(user.tasks[user.tasks.length - 1]); // Отправляем созданную задачу
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};
