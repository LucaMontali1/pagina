// ============================================
// SESSION MANAGER - Sistema de Gestión Escolar
// Colegio Dante Alighieri
// ============================================

const SessionManager = {
  
  // Configuración de Supabase
  SUPABASE_URL: 'https://zcuodmndmrrvamyvgczm.supabase.co',
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjdW9kbW5kbXJydmFteXZnY3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTA1ODMsImV4cCI6MjA2NzkyNjU4M30.l0XJgelYCQQ8sQyhL3XsY_4FOLGu6DwyZQ7PiocyLEE',
  
  supabaseClient: null,

  // Inicializar cliente de Supabase
  init() {
    if (!this.supabaseClient && typeof supabase !== 'undefined') {
      this.supabaseClient = supabase.createClient(this.SUPABASE_URL, this.SUPABASE_KEY);
    }
  },

  // Verificar sesión del usuario
  async verificarSesion() {
    this.init();
    
    const loggedIn = sessionStorage.getItem('loggedIn');
    const userId = sessionStorage.getItem('userId');
    const userRole = sessionStorage.getItem('userRole');
    
    console.log('Verificando sesión:', { loggedIn, userId, userRole });

    // Si no hay sesión en sessionStorage, redirigir a login
    if (!loggedIn || loggedIn !== 'true') {
      console.warn('No hay sesión activa, redirigiendo a login');
      this.mostrarAdvertenciaSeguridad();
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 2000);
      return null;
    }

    // Retornar datos de sesión
    return {
      id: userId,
      username: sessionStorage.getItem('userName'),
      role: userRole,
      year: parseInt(sessionStorage.getItem('userYear')) || null,
      nombre_completo: sessionStorage.getItem('nombreCompleto'),
      dni: sessionStorage.getItem('dni'),
      direccion: sessionStorage.getItem('direccion'),
      tutores: sessionStorage.getItem('tutores'),
      email: sessionStorage.getItem('email'),
      telefono: sessionStorage.getItem('telefono')
    };
  },

  // Verificar permisos según rol
  verificarPermiso(rolesPermitidos) {
    const userRole = sessionStorage.getItem('userRole');
    
    if (!rolesPermitidos.includes(userRole)) {
      console.warn(`Acceso denegado. Rol actual: ${userRole}, Roles permitidos:`, rolesPermitidos);
      this.mostrarAdvertenciaSeguridad();
      setTimeout(() => {
        this.redirigirSegunRol();
      }, 2000);
      return false;
    }
    
    return true;
  },

  // Obtener usuario actual
  obtenerUsuarioActual() {
    return {
      id: sessionStorage.getItem('userId'),
      username: sessionStorage.getItem('userName'),
      role: sessionStorage.getItem('userRole'),
      year: parseInt(sessionStorage.getItem('userYear')) || null,
      nombre_completo: sessionStorage.getItem('nombreCompleto'),
      dni: sessionStorage.getItem('dni'),
      direccion: sessionStorage.getItem('direccion'),
      tutores: sessionStorage.getItem('tutores'),
      email: sessionStorage.getItem('email'),
      telefono: sessionStorage.getItem('telefono')
    };
  },

  // Cerrar sesión
  async cerrarSesion() {
    this.init();
    
    const sessionToken = sessionStorage.getItem('sessionToken');
    
    // Intentar cerrar sesión en Supabase (si existe token)
    if (sessionToken && this.supabaseClient) {
      try {
        await this.supabaseClient.rpc('cerrar_sesion', { p_token: sessionToken });
      } catch (error) {
        console.error('Error al cerrar sesión en Supabase:', error);
      }
    }
    
    // Limpiar sessionStorage
    sessionStorage.clear();
    
    // Redirigir a login
    window.location.href = 'login.html';
  },

  // Redirigir según rol del usuario
  redirigirSegunRol() {
    const userRole = sessionStorage.getItem('userRole');
    const userYear = sessionStorage.getItem('userYear');
    
    if (userRole === 'estudiante' && userYear) {
      window.location.href = `${userYear} año.html`;
    } else if (userRole === 'docente') {
      window.location.href = 'Profesores.html';
    } else if (userRole === 'preceptor') {
      window.location.href = 'preceptoria.html';
    } else {
      window.location.href = 'login.html';
    }
  },

  // Mostrar advertencia de seguridad
  mostrarAdvertenciaSeguridad() {
    const warningElement = document.getElementById('securityWarning');
    if (warningElement) {
      warningElement.style.display = 'flex';
    }
  },

  // Ocultar advertencia de seguridad
  ocultarAdvertenciaSeguridad() {
    const warningElement = document.getElementById('securityWarning');
    if (warningElement) {
      warningElement.style.display = 'none';
    }
  },

  // Validar sesión periódicamente
  iniciarValidacionPeriodica(intervalo = 30000) {
    setInterval(async () => {
      const sessionData = await this.verificarSesion();
      if (!sessionData) {
        console.log('Sesión expirada, cerrando...');
        this.cerrarSesion();
      }
    }, intervalo);
  },

  // Verificar si la sesión está activa
  estaActivo() {
    const loggedIn = sessionStorage.getItem('loggedIn');
    return loggedIn === 'true';
  },

  // Obtener tiempo restante de sesión (si existe expires)
  getTiempoRestante() {
    const expires = sessionStorage.getItem('sessionExpires');
    if (!expires) return null;
    
    const expiresDate = new Date(expires);
    const ahora = new Date();
    const diferencia = expiresDate - ahora;
    
    if (diferencia <= 0) return 0;
    
    return Math.floor(diferencia / 1000 / 60); // Retorna minutos
  }
};

// Log de inicialización
console.log('✅ SessionManager cargado correctamente');

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.SessionManager = SessionManager;
}