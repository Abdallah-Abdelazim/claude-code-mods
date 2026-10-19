import type { Register } from 'claude-code'

// Hooks nest in plugin order, first outermost: this draws a rule above the bands only when it is listed before the other mods.
export const register: Register = on => {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Text dimColor>{'─'.repeat(e.props.bodyColumns)}</Text>
        {below}
      </Box>
    )
  })
}
