const express = require('express');
const { body, validationResult, param } = require('express-validator');
const userSchema = require('../models/user');
const fetch = require('node-fetch');

const router = express.Router();

//creación de user 
router.post('/users',
    [
        body('name').notEmpty().withMessage('El nombre es obligatorio'),
        body('age').isInt({ min: 1 }).withMessage('La edad debe ser un número entero positivo'),
        body('email').isEmail().withMessage('El correo electrónico no es válido'),
    ], async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const user = userSchema(req.body);
        try {
            const data = await user.save();
            res.json(data);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    });

//get users
router.get('/users', (req, res) => {
    userSchema
        .find()
        .then((data) => res.json(data))
        .catch((error) => res.json({ message: error }));
});

//get user by id
router.get('/users/:id',
    [
        param('id').isMongoId().withMessage('El formato de ID no es compatible con MongoDB'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const user = await userSchema.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'El ID no existe en la base de datos' });
        }

        res.json(user);
    });

//update user
router.put('/users/:id',
    [
        body('name').optional().notEmpty().withMessage('El nombre no puede estar vacío'),
        body('age').optional().isInt({ min: 1 }).withMessage('La edad debe ser un número entero positivo'),
        body('email').optional().isEmail().withMessage('El correo electrónico no es válido'),
    ],
    async (req, res) => {
        const { id } = req.params;
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const { name, age, email } = req.body;
            const data = await userSchema.updateOne({ _id: id }, { $set: { name, age, email } });
            res.json(data);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
);

//delete user
router.delete('/users/:id',
    [
        param('id').isMongoId().withMessage('El formato de ID no es compatible con MongoDB'),
    ],
    async (req, res) => {
        const { id } = req.params;

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const userExists = await userSchema.exists({ _id: id });
        if (!userExists) {
            return res.status(404).json({ message: 'El ID no existe en la base de datos' });
        }
        try {
            const data = await userSchema.deleteOne({ _id: id });
            res.json(data);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
);

//delete all users
router.delete('/users', (req, res) => {
    userSchema
        .deleteMany()
        .then((data) => res.json(data))
        .catch((error) => res.json({ message: error }));
})

//------------conect to external API------------
//generar usuario aleatorio
router.get('/randomUsers', async (req, res) => {
    try {
        const resAPI = await fetch('https://randomuser.me/api/');

        if (resAPI.ok) {
            const datosJSON = await resAPI.json();
            const newUser = new userSchema({
                name: datosJSON.results[0].name.first,
                age: datosJSON.results[0].dob.age,
                email: datosJSON.results[0].email
            });


            await newUser.save();
            res.json({ mensaje: 'Usuario aleatorio generado' });
        } else {
            res.status(resAPI.status).json({ mensaje: 'Error al obtener datos de la API externa' });
        }
    } catch (error) {
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
});

//generar varios usuarios aleatorios
router.get('/randomUsers/:cantidad', async (req, res) => {
    try {
        const cantUsers = parseInt(req.params.cantidad);

        if (isNaN(cantUsers) || cantUsers <= 0) {
            return res.status(400).json({ mensaje: 'La cantidad debe ser un número entero positivo' });
        }

        const veces = Array.from({ length: cantUsers }, async () => {
            const resAPI = await fetch('https://randomuser.me/api/');
            if (!resAPI.ok) {
                throw new Error('Error al obtener datos de la API externa');
            }

            const datosJSON = await resAPI.json();
            return {
                name: datosJSON.results[0].name.first,
                age: datosJSON.results[0].dob.age,
                email: datosJSON.results[0].email
            };
        });

        const usersCreated = await Promise.all(veces);
        await userSchema.insertMany(usersCreated);
        res.json({ mensaje: `${cantUsers} usuarios aleatorios generados` });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error interno del servidor', error: error.message });
    }
});


module.exports = router;