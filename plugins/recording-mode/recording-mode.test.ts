import { expect, mock, test } from 'claude-code/testing'
import { maskText } from './hooks/mask'

const props = {
  hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 100, scroll: { offset: 0, bodyRows: 4 }, view: {},
}
const quiet = { strict: false, words: [] as string[] }

test('masks keys, emails and phones but leaves commits and code alone', () => {
  const out = maskText(
    'key sk-abcdefghijklmnop1234 gh ghp_abcdefghijklmnopqrstu slack xoxb-1234567890-abc Authorization: Bearer abcdef1234567890xyz\n' +
      'export API_TOKEN=hunter2value\nmail me@corp.example.com call +1 (555) 123-4567 or 555-123-4567\n' +
      'commit 3f2a9c1d8e7b6a5f4e3d2c1b0a9f8e7d6c5b4a39 const x = 42',
    quiet,
  )
  expect(out).toContain('key [key] gh [key] slack [key] Authorization: [key]')
  expect(out).toContain('export API_TOKEN=[key]')
  expect(out).toContain('mail [email] call [phone] or [phone]')
  expect(out).toContain('commit 3f2a9c1d8e7b6a5f4e3d2c1b0a9f8e7d6c5b4a39 const x = 42')
})

test('strict also hides amounts and home paths, and private words become [private]', () => {
  const strict = { strict: true, words: ['Falcon'] }
  expect(maskText('cost $12.50 in /Users/jo/app and /home/jo/x about falcon', strict)).toBe(
    'cost [$] in ~/app and ~/x about [private]',
  )
  expect(maskText('cost $12.50 in /Users/jo/app', quiet)).toBe('cost $12.50 in /Users/jo/app')
})

test('masks JWTs, private-key blocks, Stripe and Google keys', () => {
  const out = maskText(
    'jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmn stripe sk_live_abcdefghijklmnop1234 ' +
      'google AIzaSyA1234567890abcdefghijklmnopqrstuv\n-----BEGIN RSA PRIVATE KEY-----\nMIIEabc\n-----END RSA PRIVATE KEY-----\nafter',
    quiet,
  )
  expect(out).toBe('jwt [key] stripe [key] google [key]\n[key]\nafter')
})

test('only upper-case secret names are masked', () => {
  const text = 'input_tokens: 5\nmax_tokens = 4096\nhotkey: ctrl+o\nmonkey=1\nSECRET_KEY_BASE=abc123'
  expect(maskText(text, quiet)).toBe('input_tokens: 5\nmax_tokens = 4096\nhotkey: ctrl+o\nmonkey=1\nSECRET_KEY_BASE=[key]')
})

test('private words match whole words and leave placeholders alone', () => {
  const cfg = { strict: false, words: ['key', 'mail'] }
  expect(maskText('key sk-abcdefghijklmnop1234 mailbox mail me@corp.example.com', cfg)).toBe(
    '[private] [key] mailbox [private] [email]',
  )
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`recording mode masks only the drawn text and stacks its band on ${surface}`, async ($, on) => {
    mock.clock(on, { now: Date.parse('2026-10-19T12:00:00Z') })
    mock.store(on)
    on('ui.toast', ($, e, next) => next(e))
    on('ui.status', ($, e, next) => next(e))
    let drawn = ''
    on('ui.render', { component: 'AssistantMessage' }, ($, e) => {
      drawn = e.props.text
      return $.ui.resolve(e).Box({})
    })
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
      const { Box, Text } = $.ui.resolve(e)
      return Box({ children: [Text({ children: ['other mod line'] })] })
    })
    const messageProps = { text: 'token sk-abcdefghijklmnop1234 for me@corp.example.com', isFirstOfReply: true }
    const mountMessage = async () => {
      const ui = await $.ui.mount({ plugin: 'recording-mode', surface, component: 'AssistantMessage', requestId: 'm1', props: messageProps } as never)
      await ui.unmount()
    }

    await mountMessage()
    expect(drawn).toBe(messageProps.text)

    await $.command.run({ command: 'rec', args: '' } as never)
    await mountMessage()
    expect(drawn).toBe('token [key] for [email]')

    const band = await $.ui.mount({ plugin: 'recording-mode', surface, component: 'AbovePrompt', props })
    const text = JSON.stringify(await band.drawn())
    expect(text).toContain('● REC')
    expect(text.indexOf('● REC')).toBeLessThan(text.indexOf('other mod line'))
  })
}
