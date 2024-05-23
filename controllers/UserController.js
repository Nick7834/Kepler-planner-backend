import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

import UserSchema from '../modules/User.js';

export const login = async (req, res) => {
    try {

        const user = await UserSchema.findOne({ email: req.body.email });

        if(!user) {
            return res.status(404).json({
                message: 'Неверный логин или пароль',
            });
        }

        const isValidPass = await bcrypt.compare(req.body.password, user._doc.passwordHash);

        if(!isValidPass) {
            return res.status(400).json({
                message: 'Неверный логин или пароль',
            })
        }

        const token = jwt.sign({
            _id: user._id,
        }, 'secret123', 
        
        {
            expiresIn: '30d',
        });

        const { passwordHash, ...userData } = user._doc;
   
        res.json({
            ...userData,
            token,
        });

    } catch (err) {
        console.log(err)
        res.status(500).json({
            message: 'Не удалось авторизоваться:('
        })
    }
}

export const register =  async (req, res) => {
    try {
   
        const password = req.body.password;
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
   
        const doc = new UserSchema({
           email: req.body.email,
           fullName: req.body.fullName,
           avatarUrl: req.body.avatarUrl,
           backgroundImage: req.body.backgroundImage,
           passwordHash: hash,
        });
   
        const user = await doc.save();

        const token = jwt.sign({
            _id: user._id,
        }, 'secret123', 
        
        {
            expiresIn: '30d',
        });

        const { passwordHash, ...userData } = user._doc;
   
        res.json({
            ...userData,
            token,
        });

    } catch (err) {
        console.log(err)
        res.status(500).json({
            message: 'Не удалось зарегистрироваться:('
        })
    }
}

export const getMe = async (req, res) => {
    try {
        const user = await UserSchema.findById(req.userId);

        if (!user) {
            return res.status(403).json({
                message: 'Пользователь не найден:('
            });
        }

        const { passwordHash, ...userData } = user._doc;
   
        res.json(userData);

    } catch(err) {
        console.log(err)
        res.status(500).json({
            message: 'Нет доступа'
        })
    }
}