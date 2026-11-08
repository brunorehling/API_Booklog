import express from 'express'
import cors from 'cors'
import 'dotenv/config'

import routesAutores from './routes/autores'
import routesLivros from './routes/livros'
import routesUsuarios from './routes/usuarios'
import routesLogin from './routes/login'
import routesReviews from './routes/reviews'
import routesDenuncias from './routes/denuncia'
import routesDashboard from './routes/dashboard'
import routesAdminLogin from './routes/adminLogin'
import routesAdmins from './routes/admins'

const app = express()
const port = 3000

app.use(express.json())
app.use(cors())

app.use("/autores", routesAutores)
app.use("/livros", routesLivros)
app.use("/usuarios", routesUsuarios)
app.use("/usuarios/login", routesLogin)
app.use("/reviews", routesReviews)
app.use("/denuncias", routesDenuncias)
app.use("/dashboard", routesDashboard)
app.use("/admins/login", routesAdminLogin)
app.use("/admins", routesAdmins)


app.get('/', (req, res) => {
  res.send('API: Revenda de Veículos')
})

// Na Vercel o servidor é gerenciado por ela; localmente precisamos subir com listen
if (!process.env.VERCEL) {
  app.listen(port, () => console.log(`API rodando em http://localhost:${port}`))
}

export default app