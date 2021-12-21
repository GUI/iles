module.exports = (...args) => new Promise((resolve, reject) => {
  import('../dist/i18n.js')
    .then(m => resolve(m.default(...args)))
    .catch(reject)
})
