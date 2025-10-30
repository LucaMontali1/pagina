// server.js
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de la base de datos PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'colegio_dante',
  password: process.env.DB_PASSWORD || 'tu_contraseña',
  port: process.env.DB_PORT || 5432,
});

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.static('public')); // Servir archivos estáticos

// Clave secreta para JWT
const JWT_SECRET = process.env.JWT_SECRET || 'tu_clave_secreta_muy_segura_aqui';

// Función para crear hash de contraseña
const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

// Ruta para servir la página principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Ruta para login
app.post('/api/login', async (req, res) => {
  try {
    const { usuario, contraseña } = req.body;
    
    console.log('Intento de login para usuario:', usuario);
    
    // Buscar usuario en la base de datos
    const query = `
      SELECT u.*, r.nombre as rol_nombre 
      FROM usuarios u 
      LEFT JOIN roles r ON u.rol_id = r.id 
      WHERE u.usuario = $1 AND u.activo = true
    `;
    
    const result = await pool.query(query, [usuario]);
    
    if (result.rows.length === 0) {
      console.log('Usuario no encontrado:', usuario);
      return res.status(401).json({ 
        success: false, 
        message: 'Usuario no encontrado' 
      });
    }
    
    const user = result.rows[0];
    console.log('Usuario encontrado:', user.usuario, 'Rol:', user.rol_nombre);
    
    // Verificar contraseña
    const passwordMatch = await bcrypt.compare(contraseña, user.contraseña);
    
    if (!passwordMatch) {
      console.log('Contraseña incorrecta para usuario:', usuario);
      return res.status(401).json({ 
        success: false, 
        message: 'Contraseña incorrecta' 
      });
    }
    
    // Generar token JWT
    const token = jwt.sign(
      { 
        id: user.id, 
        usuario: user.usuario, 
        rol: user.rol_nombre 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log('Login exitoso para usuario:', usuario);
    
    res.json({
      success: true,
      message: 'Login exitoso',
      token: token,
      user: {
        id: user.id,
        usuario: user.usuario,
        nombre_completo: user.nombre_completo,
        rol: user.rol_nombre
      }
    });
    
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor' 
    });
  }
});

// Middleware para verificar token JWT
const verificarToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Token no proporcionado' 
    });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      message: 'Token inválido' 
    });
  }
};

// Ruta protegida para obtener información del usuario
app.get('/api/user', verificarToken, async (req, res) => {
  try {
    const query = `
      SELECT u.*, r.nombre as rol_nombre 
      FROM usuarios u 
      LEFT JOIN roles r ON u.rol_id = r.id 
      WHERE u.id = $1
    `;
    
    const result = await pool.query(query, [req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Usuario no encontrado' 
      });
    }
    
    const user = result.rows[0];
    delete user.contraseña; // No enviar la contraseña
    
    res.json({
      success: true,
      user: user
    });
    
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor' 
    });
  }
});

// Ruta para obtener estudiantes (solo para profesores/admin)
app.get('/api/estudiantes', verificarToken, async (req, res) => {
  try {
    if (req.user.rol !== 'profesor' && req.user.rol !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acceso denegado' 
      });
    }
    
    const query = `
      SELECT u.nombre_completo, e.legajo, e.curso, e.fecha_nacimiento
      FROM estudiantes e
      JOIN usuarios u ON e.usuario_id = u.id
      WHERE u.activo = true
      ORDER BY e.curso, u.nombre_completo
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      estudiantes: result.rows
    });
    
  } catch (error) {
    console.error('Error obteniendo estudiantes:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor' 
    });
  }
});

// Ruta para inicializar datos de prueba (solo para desarrollo)
app.post('/api/init-data', async (req, res) => {
  try {
    console.log('Inicializando datos de prueba...');
    
    // Insertar roles
    await pool.query(`
      INSERT INTO roles (nombre, descripcion) VALUES 
      ('admin', 'Administrador del sistema'),
      ('profesor', 'Profesor del colegio'),
      ('estudiante', 'Estudiante del colegio'),
      ('preceptor', 'Preceptor del colegio')
      ON CONFLICT (nombre) DO NOTHING
    `);
    
    // Crear contraseñas hasheadas
    const passwordAdmin = await hashPassword('admin123');
    const passwordProfesor = await hashPassword('profesor123');
    const passwordEstudiante = await hashPassword('estudiante123');
    const passwordPreceptor = await hashPassword('preceptor123');
    
    // Insertar usuarios
    await pool.query(`
      INSERT INTO usuarios (usuario, contraseña, nombre_completo, email, rol_id) VALUES 
      ('admin', $1, 'Administrador Sistema', 'admin@colegiodante.edu.ar', 1),
      ('profesor1', $2, 'Juan Carlos Pérez', 'jperez@colegiodante.edu.ar', 2),
      ('estudiante1', $3, 'María González', 'mgonzalez@colegiodante.edu.ar', 3),
      ('preceptor1', $4, 'Ana María López', 'alopez@colegiodante.edu.ar', 4)
      ON CONFLICT (usuario) DO NOTHING
    `, [passwordAdmin, passwordProfesor, passwordEstudiante, passwordPreceptor]);
    
    // Insertar datos de profesores
    await pool.query(`
      INSERT INTO profesores (usuario_id, legajo, especialidad, fecha_ingreso, titulo) VALUES 
      (2, 'PROF001', 'Matemáticas', '2020-03-01', 'Licenciado en Matemáticas'),
      (4, 'PREC001', 'Preceptoría', '2019-02-15', 'Licenciado en Educación')
      ON CONFLICT (legajo) DO NOTHING
    `);
    
    // Insertar datos de estudiantes
    await pool.query(`
      INSERT INTO estudiantes (usuario_id, legajo, fecha_nacimiento, curso, año_ingreso, tutor_nombre, tutor_telefono, tutor_email) VALUES 
      (3, 'EST001', '2008-05-15', '1° A', 2024, 'Roberto González', '387-1234567', 'rgonzalez@gmail.com')
      ON CONFLICT (legajo) DO NOTHING
    `);
    
    console.log('Datos de prueba inicializados correctamente');
    
    res.json({ 
      success: true, 
      message: 'Datos inicializados correctamente' 
    });
    
  } catch (error) {
    console.error('Error inicializando datos:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error inicializando datos: ' + error.message 
    });
  }
});

// Ruta para verificar conexión a la base de datos
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      success: true,
      message: 'Conexión a la base de datos exitosa',
      timestamp: result.rows[0].now
    });
  } catch (error) {
    console.error('Error de conexión a la base de datos:', error);
    res.status(500).json({
      success: false,
      message: 'Error de conexión a la base de datos: ' + error.message
    });
  }
});

// Ruta para logout
app.post('/api/logout', verificarToken, (req, res) => {
  res.json({
    success: true,
    message: 'Logout exitoso'
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📁 Archivos estáticos servidos desde: ${path.join(__dirname, 'public')}`);
  console.log(`🔗 Base de datos: ${process.env.DB_NAME || 'colegio_dante'}`);
  console.log(`🔑 Credenciales de prueba:`);
  console.log(`   Admin: admin / admin123`);
  console.log(`   Profesor: profesor1 / profesor123`);
  console.log(`   Estudiante: estudiante1 / estudiante123`);
});

// Manejo de errores de conexión a la base de datos
pool.on('error', (err) => {
  console.error('❌ Error de conexión a PostgreSQL:', err);
});

// Manejo de cierre graceful
process.on('SIGINT', async () => {
  console.log('⏹️  Cerrando servidor...');
  await pool.end();
  process.exit(0);
});

// Manejo de errores no capturados
process.on('unhandledRejection', (err) => {
  console.error('❌ Error no manejado:', err);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Excepción no capturada:', err);
  process.exit(1);
});