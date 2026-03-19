import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        courses: 'Courses.html',
        noticeboard: 'NoticeBoard.html',
        student: 'Student.html',
        about: 'About.html'
      }
    }
  }
})
