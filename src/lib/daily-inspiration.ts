// One entry per calendar date: every month starts the same cycle at day one.
const dailyQuotes = [
  { text: 'Well done is better than well said.', author: 'Benjamin Franklin' },
  { text: 'Lost time is never found again.', author: 'Benjamin Franklin' },
  { text: 'Energy and persistence conquer all things.', author: 'Benjamin Franklin' },
  { text: 'Nothing great was ever achieved without enthusiasm.', author: 'Ralph Waldo Emerson' },
  { text: 'Trust thyself: every heart vibrates to that iron string.', author: 'Ralph Waldo Emerson' },
  { text: 'Brevity is the soul of wit.', author: 'William Shakespeare' },
  { text: 'We know what we are, but know not what we may be.', author: 'William Shakespeare' },
  { text: 'Our doubts are traitors.', author: 'William Shakespeare' },
  { text: 'Wisely and slow; they stumble that run fast.', author: 'William Shakespeare' },
  { text: 'There is nothing either good or bad, but thinking makes it so.', author: 'William Shakespeare' },
  { text: 'To thine own self be true.', author: 'William Shakespeare' },
  { text: 'I am not afraid of storms, for I am learning how to sail my ship.', author: 'Louisa May Alcott' },
  { text: 'There is no charm equal to tenderness of heart.', author: 'Jane Austen' },
  { text: 'I declare after all there is no enjoyment like reading!', author: 'Jane Austen' },
  { text: 'I dwell in Possibility.', author: 'Emily Dickinson' },
  { text: 'Forever is composed of Nows.', author: 'Emily Dickinson' },
  { text: 'Hope is the thing with feathers.', author: 'Emily Dickinson' },
  { text: 'I am large, I contain multitudes.', author: 'Walt Whitman' },
  { text: 'We are such stuff as dreams are made on.', author: 'William Shakespeare' },
  { text: 'If I have seen further it is by standing on the shoulders of Giants.', author: 'Isaac Newton' },
  { text: 'The unexamined life is not worth living.', author: 'Socrates, in Plato’s Apology' },
  { text: 'All men by nature desire to know.', author: 'Aristotle' },
  { text: 'Knowledge itself is power.', author: 'Francis Bacon' },
  { text: 'Reading maketh a full man; conference a ready man; and writing an exact man.', author: 'Francis Bacon' },
  { text: 'A thing of beauty is a joy for ever.', author: 'John Keats' },
  { text: 'To strive, to seek, to find, and not to yield.', author: 'Alfred, Lord Tennyson' },
  { text: 'The child is father of the man.', author: 'William Wordsworth' },
  { text: 'If Winter comes, can Spring be far behind?', author: 'Percy Bysshe Shelley' },
  { text: 'A little learning is a dangerous thing.', author: 'Alexander Pope' },
  { text: 'To err is human; to forgive, divine.', author: 'Alexander Pope' },
  { text: 'A journey of a thousand miles begins with a single step.', author: 'Lao Tzu' },
] as const

export function greetingFor(date: Date): string {
  const hour = date.getHours()
  if (hour >= 5 && hour < 11) return '早上好'
  if (hour >= 11 && hour < 14) return '中午好'
  if (hour >= 14 && hour < 18) return '下午好'
  return '晚上好'
}

export function quoteFor(date: Date) {
  return dailyQuotes[date.getDate() - 1]
}
