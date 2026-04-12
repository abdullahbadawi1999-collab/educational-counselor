import { useState } from 'react'
import { FiLock, FiUser, FiLogIn } from 'react-icons/fi'

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    setTimeout(() => {
      if (username === 'abdullah' && password === '200100') {
        localStorage.setItem('auth', 'true')
        onLogin()
      } else {
        setError('اسم المستخدم أو كلمة المرور غير صحيحة')
      }
      setLoading(false)
    }, 500)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1B6B4A 0%, #145236 50%, #0d3a25 100%)',
      padding: 20
    }}>
      <div style={{
        background: 'white', borderRadius: 20, padding: '40px 36px',
        width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 70, height: 70, borderRadius: '50%', margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #1B6B4A, #2E7D32)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 15px rgba(27, 107, 74, 0.3)'
          }}>
            <span style={{ fontSize: 32 }}>📖</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>الماهر بالقرآن</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1B6B4A', margin: 0 }}>الموجه التربوي</h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FiUser size={14} /> اسم المستخدم
            </label>
            <input
              className="form-control"
              type="text"
              placeholder="أدخل اسم المستخدم"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              style={{ fontSize: 16, padding: '12px 14px' }}
            />
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FiLock size={14} /> كلمة المرور
            </label>
            <input
              className="form-control"
              type="password"
              placeholder="أدخل كلمة المرور"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              style={{ fontSize: 16, padding: '12px 14px' }}
            />
          </div>

          {error && (
            <div style={{
              background: '#FFEBEE', color: '#D32F2F', padding: '10px 14px',
              borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 16,
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="btn btn-primary"
            style={{
              width: '100%', padding: '14px', fontSize: 16, fontWeight: 700,
              justifyContent: 'center', marginTop: 8, borderRadius: 12
            }}
          >
            <FiLogIn size={18} />
            {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
          </button>
        </form>
      </div>
    </div>
  )
}
