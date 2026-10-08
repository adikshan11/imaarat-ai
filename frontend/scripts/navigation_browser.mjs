const APP_URL = process.env.APP_URL ?? 'http://127.0.0.1:3000'

export async function verifySignIn(page) {
  let checks = 0
  const check = (value, name) => {
    if (!value) throw new Error(name)
    checks++
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(APP_URL + '/app/#new')
  await page.evaluate(() => localStorage.setItem('imaarat.lang', 'en'))
  await page.reload()
  await page.locator('.signin-page').waitFor()
  check(await page.locator('.tab-item').count() === 0, 'app opened before choosing sign-in or the demo')
  check(await page.getByRole('button', { name: 'Continue with GitHub' }).isVisible(), 'GitHub sign-in missing')
  check(await page.getByRole('button', { name: 'Continue with Google' }).count() === 0, 'unconfigured Google sign-in shown')
  await page.getByRole('button', { name: 'Try the demo' }).click()
  await page.locator('.tab-item').first().waitFor()
  check(await page.evaluate(() => location.hash) === '#new', 'demo lost the requested page')
  await page.reload()
  await page.locator('.tab-item').first().waitFor()
  check(await page.locator('.signin-page').count() === 0, 'demo choice not kept for the tab')
  await page.evaluate(() => { location.hash = 'signin' })
  await page.locator('.signin-page').waitFor()
  check(await page.getByRole('button', { name: 'Try the demo' }).isVisible(), 'sign-in page not reachable from the demo')
  await page.evaluate(() => sessionStorage.clear())
  await page.goto(APP_URL + '/app/?demo#how')
  await page.locator('.tab-item').first().waitFor()
  check(await page.locator('.signin-page').count() === 0 && await page.evaluate(() => location.search) === '', 'landing demo link asked for sign-in')
  return { checks }
}

export async function verifyCompletion(page) {
  let checks = 0
  const check = (value, name) => {
    if (!value) throw new Error(name)
    checks++
  }
  const result = { id: 901, property_id: 'Completed navigation assessment', risk_score: 20, decision: 'Accept', risk_flags: [], risk_breakdown: {}, guideline_chunks: [], comparables: [], rationale: 'Navigation fixture', review_status: 'not_required' }
  const history = { ...result, property_id: 'Other selected assessment' }
  try {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(({ result, history }) => {
      localStorage.setItem('imaarat.lang', 'en')
      const original = window.fetch
      window.navigationMock = { original, started: false, release: null }
      window.fetch = async (input, options) => {
        const path = new URL(String(input), location.href).pathname
        if (path.endsWith('/submit')) {
          window.navigationMock.started = true
          await new Promise(resolve => { window.navigationMock.release = resolve })
          window.navigationMock.started = false
          window.navigationMock.saved = true
          return Response.json(result)
        }
        if (path.endsWith('/history/901')) return Response.json(history)
        if (path.endsWith('/history')) return Response.json(window.navigationMock.saved ? [result] : [])
        if (path.endsWith('/graphql')) {
          const rows = window.navigationMock.saved ? [{ ...result, raw_input: {}, risk_flags: [], prototype_mitigation_model: {} }] : []
          const query = JSON.parse(options?.body ?? '{}').query ?? ''
          const portfolio = { submissions: rows.length, average_score: 0, pending_review: 0, total_value_inr: 0, with_sprinklers: 0, with_fire_alarm: 0, with_flood_protection: 0, mitigation_benefit: 0, decisions: {}, bands: {}, top_drivers: [] }
          return Response.json({ data: { ...(query.includes('portfolio') ? { portfolio } : {}), history: { total: rows.length, rows } } })
        }
        if (path.endsWith('/portfolio')) return Response.json({ submissions: 0, average_score: 0, pending_review: 0, total_value_inr: 0, with_sprinklers: 0, with_fire_alarm: 0, with_flood_protection: 0, mitigation_benefit: 0, decisions: {}, bands: {}, top_drivers: [] })
        if (path.endsWith('/preview')) return Response.json({})
        return original(input, options)
      }
    }, { result, history })
    await page.goto(APP_URL + '/app/#new')
    const tabs = page.locator('.tab-item')
    const active = () => page.locator('.tab-item.active').getAttribute('data-view')
    const submit = async () => {
      await page.locator('form').dispatchEvent('submit')
      await page.waitForFunction(() => window.navigationMock.started)
    }
    const finish = async () => {
      await page.evaluate(() => window.navigationMock.release())
      await page.waitForFunction(() => !document.querySelector('form'))
    }
    await page.locator('input').first().fill('Preserved draft')
    await tabs.nth(3).click()
    await tabs.nth(1).click()
    check(await page.locator('input').first().inputValue() === 'Preserved draft', 'leaving lost draft')
    await submit()
    await tabs.nth(3).click()
    await finish()
    check(await active() === 'how' && await page.evaluate(() => location.hash) === '#how', 'hidden completion replaced Guide')
    await tabs.nth(1).click()
    check(await page.locator('h1').innerText() === result.property_id, 'New did not retain completed result')
    await tabs.nth(0).click()
    await page.locator('.table-wrap tbody tr').filter({ hasText: result.property_id }).getByRole('button').click()
    await page.waitForFunction(() => document.querySelector('h1')?.textContent === 'Other selected assessment')
    check(await page.locator('h1').innerText() === history.property_id, 'history selection replaced by pending result')
    await tabs.nth(3).click()
    await tabs.nth(1).click()
    check(await page.locator('h1').innerText() === result.property_id, 'history selection lost completed New result')
    await tabs.nth(0).click()
    await page.locator('.page-heading-row > button').click()
    check(await page.locator('input').first().inputValue() === '', 'explicit new did not reset completed draft')
    await submit()
    await finish()
    check(await active() === 'new' && await page.locator('h1').innerText() === result.property_id, 'visible completion did not show result')
    await tabs.nth(0).click()
    await page.locator('.page-heading-row > button').click()
    await submit()
    await tabs.nth(3).click()
    await tabs.nth(1).click()
    await finish()
    check(await page.locator('h1').innerText() === result.property_id, 'returning before completion used stale navigation')
  } finally {
    await page.evaluate(() => {
      window.navigationMock?.release?.()
      if (window.navigationMock) window.fetch = window.navigationMock.original
      delete window.navigationMock
    })
  }
  return { checks }
}

export async function verifyNavigation(page) {
  let checks = 0
  const check = (value, name) => {
    if (!value) throw new Error(name)
    checks++
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(APP_URL + '/app/')
  await page.evaluate(() => localStorage.setItem('imaarat.lang', 'en'))
  await page.reload()
  const tabs = page.locator('.tab-item')
  const active = () => tabs.locator('xpath=self::*[@aria-current="page"]').getAttribute('data-view')
  const drag = async (from, to, cancel = false, outside = false) => {
    const start = await tabs.nth(from).boundingBox()
    const end = await tabs.nth(to).boundingBox()
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
    await page.mouse.down()
    await page.mouse.move(outside ? -30 : end.x + end.width / 2, end.y + end.height / 2, { steps: 12 })
    check(await active() === ['dashboard', 'new', 'paper', 'how'][from], 'drag committed before release')
    check(await page.locator('.tabbar').evaluate(node => node.classList.contains('is-scrubbing')), 'drag did not begin')
    if (cancel) await page.locator('.tabbar').evaluate(node => {
      node.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 }))
    })
    await page.mouse.up()
  }
  check(await page.locator('.tab-indicator').count() === 1, 'shared indicator missing')
  await tabs.nth(1).click()
  await page.locator('input').first().fill('Navigation draft')
  await drag(1, 3)
  check(await active() === 'how', 'release did not select guide')
  await page.locator('.tab-item').nth(1).dispatchEvent('click', { detail: 1 })
  check(await active() === 'how', 'ghost click changed view')
  await tabs.nth(1).click()
  check(await page.locator('input').first().inputValue() === 'Navigation draft', 'draft lost after drag')
  await drag(1, 3, true)
  check(await active() === 'new', 'pointercancel committed')
  await drag(1, 0, false, true)
  check(await active() === 'dashboard', 'captured endpoint did not clamp')
  await tabs.nth(0).focus()
  await page.keyboard.press('End')
  check(await tabs.nth(3).evaluate(node => node === document.activeElement), 'End focus')
  await page.keyboard.press('Enter')
  check(await active() === 'how', 'Enter activation')
  await page.keyboard.press('Home')
  await page.keyboard.press('Space')
  check(await active() === 'dashboard', 'Home and Space activation')
  await page.keyboard.press('Tab')
  check(await tabs.nth(1).evaluate(node => node === document.activeElement), 'native Tab order')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  check(await page.locator('.tab-indicator').evaluate(node => getComputedStyle(node).transitionDuration === '0s'), 'reduced motion')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.evaluate(() => localStorage.setItem('imaarat.lang', 'ur'))
  await page.reload()
  await tabs.nth(1).click()
  await tabs.nth(1).focus()
  await page.keyboard.press('ArrowRight')
  check(await tabs.nth(0).evaluate(node => node === document.activeElement), 'RTL keyboard direction')
  await drag(1, 3)
  check(await active() === 'how', 'RTL release target')
  for (const view of ['quality', 'integrations']) {
    await page.goto(APP_URL + `/app/#${view}`)
    await page.reload()
    await page.locator(`#${view}`).waitFor({ timeout: 15000 })
    check(await page.locator('.ops-page').count() === 1, `#${view} opens the status page`)
  }
  await page.evaluate(() => localStorage.setItem('imaarat.lang', 'en'))
  await page.goto(APP_URL + '/app/#new')
  await page.reload()
  const field = page.locator('input').first()
  await field.fill('Field drag draft')
  const bounds = await field.boundingBox()
  await page.mouse.move(bounds.x + 10, bounds.y + bounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width - 10, bounds.y + bounds.height / 2, { steps: 8 })
  await page.mouse.up()
  check(await active() === 'new', 'field gesture changed navigation')
  const select = page.getByRole('combobox').first()
  await select.click()
  check(await page.getByRole('listbox').isVisible(), 'portal dropdown did not open')
  await page.keyboard.press('Escape')
  check(await page.getByRole('listbox').count() === 0, 'portal dropdown did not close')
  await tabs.nth(3).click()
  await tabs.nth(1).click()
  check(await field.inputValue() === 'Field drag draft', 'draft lost after tap')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await tabs.nth(1).click()
  check(await field.inputValue() === '', 'cancel did not reset draft')
  return { checks }
}

export async function verifyLabels(page) {
  const codes = ['en', 'hi', 'bn', 'te', 'mr', 'ta', 'ur', 'gu', 'kn', 'or', 'ml', 'pa', 'as', 'mai', 'sat', 'ks', 'ne', 'sd', 'doi', 'gom', 'mni', 'brx', 'sa', 'bho', 'hne', 'tcy']
  let configurations = 0
  let maxCenter = 0
  let minAspect = Infinity
  let maxAspect = 0
  let maxHeight = 0
  const failures = []
  for (const code of codes) {
    await page.evaluate(code => localStorage.setItem('imaarat.lang', code), code)
    await page.goto(APP_URL + '/app/#how')
    await page.reload()
    await page.waitForFunction(code => document.documentElement.lang === code, code)
    await page.evaluate(() => document.fonts.ready)
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 })
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme)
        const labels = await page.locator('.tab-item').evaluateAll(buttons => buttons.map(button => {
          const rect = button.getBoundingClientRect()
          const icon = button.querySelector('svg').getBoundingClientRect()
          const label = button.querySelector('.optical-label')
          const context = document.createElement('canvas').getContext('2d')
          const style = getComputedStyle(label)
          context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
          context.direction = style.direction
          const content = label.firstChild
          const range = document.createRange()
          const lines = new Map()
          for (let index = 0; index < content.length; index++) {
            range.setStart(content, index)
            range.setEnd(content, index + 1)
            const top = range.getBoundingClientRect().top
            lines.set(top, (lines.get(top) ?? '') + content.textContent[index])
          }
          const marker = document.createElement('span')
          marker.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline;line-height:0'
          label.appendChild(marker)
          const baseline = marker.getBoundingClientRect().top
          marker.remove()
          const last = Math.max(...lines.keys())
          let top = Infinity
          let bottom = -Infinity
          for (const [lineTop, line] of lines) {
            const metrics = context.measureText(line)
            top = Math.min(top, baseline - last + lineTop - metrics.actualBoundingBoxAscent)
            bottom = Math.max(bottom, baseline - last + lineTop + metrics.actualBoundingBoxDescent)
          }
          const bounds = label.getBoundingClientRect()
          return {
            text: content.textContent,
            center: Math.abs((Math.min(icon.top, top) + Math.max(icon.bottom, bottom)) / 2 - (rect.top + rect.bottom) / 2),
            outside: bounds.left < rect.left - 1 || bounds.right > rect.right + 1 || top < rect.top - 1 || bottom > rect.bottom + 1,
            overflow: label.scrollWidth > label.clientWidth + 1,
          }
        }))
        const shape = await page.locator('.tab-indicator').evaluate(node => {
          const rect = node.getBoundingClientRect()
          return { aspect: rect.width / rect.height, radius: parseFloat(getComputedStyle(node).borderRadius), indicatorHeight: rect.height, height: node.closest('nav').getBoundingClientRect().height, buttons: Array.from(node.parentElement.querySelectorAll('.tab-item')).map(button => ({ text: button.textContent, width: button.offsetWidth, captionHeight: button.querySelector('.optical-label').offsetHeight })) }
        })
        minAspect = Math.min(minAspect, shape.aspect)
        maxAspect = Math.max(maxAspect, shape.aspect)
        maxHeight = Math.max(maxHeight, shape.height)
        if (shape.radius < shape.indicatorHeight / 2 || shape.height > 72) failures.push({ code, width, theme, shape })
        configurations++
        maxCenter = Math.max(maxCenter, ...labels.map(label => label.center))
        if (labels.some(label => label.center > 5 || label.outside || label.overflow)) failures.push({ code, width, theme, labels })
      }
    }
  }
  if (failures.length) throw new Error(JSON.stringify({ configurations, maxCenter, failures }))
  return { configurations, labels: configurations * 4, maxCenter, minAspect, maxAspect, maxHeight }
}

export async function verifyTouch(page) {
  const session = await page.context().newCDPSession(page)
  let checks = 0
  const check = (value, name) => {
    if (!value) throw new Error(name)
    checks++
  }
  const swipe = async (start, end, y) => {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start, y }] })
    for (let index = 1; index <= 12; index++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start + (end - start) * index / 12, y }] })
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
  try {
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
    for (const code of ['en', 'ur']) {
      await page.evaluate(code => localStorage.setItem('imaarat.lang', code), code)
      await page.goto(APP_URL + '/app/')
      await page.reload()
      await page.locator('.tab-item').nth(0).click()
      const start = await page.locator('.tab-item').nth(0).boundingBox()
      const end = await page.locator('.tab-item').nth(3).boundingBox()
      await swipe(start.x + start.width / 2, end.x + end.width / 2, start.y + start.height / 2)
      check(await page.locator('.tab-item.active').getAttribute('data-view') === 'how', `${code} native touch release`)
    }
  } finally {
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: false })
    await session.detach()
  }
  return { checks }
}

export async function verifyDesktop(page) {
  await page.evaluate(() => localStorage.setItem('imaarat.lang', 'ml'))
  await page.goto(APP_URL + '/app/')
  await page.reload()
  await page.setViewportSize({ width: 1024, height: 900 })
  await page.evaluate(() => document.fonts.ready)
  const action = await page.locator('.page-heading-row > button').boundingBox()
  if (action.height > 48) throw new Error(`New assessment action unnecessarily wrapped: ${action.height}px`)
  await page.locator('.page-heading-row > button').click()
  if (await page.locator('.nav-item.active').getAttribute('data-view') !== 'new') throw new Error('Desktop new action failed')
  await page.locator('.nav-item[data-view="dashboard"]').click()
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight))
  const sidebar = await page.evaluate(() => { const box = document.querySelector('.sidebar').getBoundingClientRect(); return { top: box.top, bottom: box.bottom, height: innerHeight } })
  if (Math.abs(sidebar.top) > 1 || Math.abs(sidebar.bottom - sidebar.height) > 1) throw new Error(`Sidebar does not fill the window after scrolling: ${JSON.stringify(sidebar)}`)
  await page.goto(APP_URL + '/')
  await page.getByRole('tab', { name: /Scoring/ }).click()
  if (!await page.getByRole('tabpanel', { name: /Scoring/ }).isVisible()) throw new Error('Landing step tabs do not switch')
  return { checks: 4, action }
}

export async function verifyAccount(page) {
  let checks = 0
  const check = (value, name) => {
    if (!value) throw new Error(name)
    checks++
  }
  const profile = { full_name: null, phone: null, has_photo: false, complete: false }
  let signedIn = true
  await page.route('**/auth/providers', (route) => route.fulfill({ json: { github: true, google: false } }))
  await page.route('**/auth/session', (route) => signedIn ? route.fulfill({ json: { role: 'reviewer', github_id: 7, name: 'asha', csrf_token: 'c'.repeat(64), profile } }) : route.fulfill({ status: 401, json: { detail: 'Sign in' } }))
  await page.route('**/auth/profile', (route) => {
    const body = route.request().postDataJSON()
    Object.assign(profile, { full_name: body.full_name, phone: body.phone, complete: true })
    return route.fulfill({ json: profile })
  })
  await page.route('**/auth/logout', (route) => { signedIn = false; return route.fulfill({ status: 204 }) })
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(APP_URL + '/app/')
  await page.evaluate(() => localStorage.setItem('imaarat.lang', 'en'))
  await page.reload()
  await page.getByRole('heading', { name: 'Set up your profile' }).waitFor()
  check(await page.locator('.nav-item').count() === 0, 'app opened before the profile was filled')
  await page.getByLabel('Full name').fill('Asha Rao')
  await page.getByLabel('Mobile number').fill('+91 98765 43210')
  await page.getByRole('button', { name: 'Save and continue' }).click()
  await page.locator('.nav-item').first().waitFor()
  await page.getByRole('button', { name: 'Account: Asha Rao' }).click()
  const menu = await page.locator('.account-menu:popover-open').boundingBox()
  check(menu && menu.x >= 0 && menu.y >= 0 && menu.x + menu.width <= 1280 && menu.y + menu.height <= 800, `account menu off screen: ${JSON.stringify(menu)}`)
  await page.getByRole('button', { name: 'Profile and settings' }).click()
  check(await page.getByRole('heading', { name: 'Profile and settings' }).isVisible(), 'settings page not opened')
  check(await page.getByLabel('Full name').inputValue() === 'Asha Rao', 'saved name not shown in settings')
  await page.getByRole('button', { name: 'Account: Asha Rao' }).click()
  await page.locator('.account-menu:popover-open').getByRole('button', { name: 'Sign out' }).click()
  await page.locator('.signin-page').waitFor()
  check(true, 'sign out')
  return { checks }
}