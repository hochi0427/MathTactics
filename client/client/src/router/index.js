import { createRouter, createWebHistory } from 'vue-router'
import HostView from '../views/HostView.vue'
import JoinView from '../views/JoinView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/join' },
    { path: '/host', component: HostView },
    { path: '/join', component: JoinView }
  ]
})

export default router