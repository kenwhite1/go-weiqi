// English translations keyed by the exact Russian source string.
// Russian stays the default; English is the switchable/auto-detected second language.
export const EN: Record<string, string> = {
  // brand
  'Окружай камни, строй территорию': 'Surround stones, build territory',

  // App.tsx - loading / setup / result
  'Расставляем доску': 'Setting up the board',
  'Одиночная игра': 'Solo game',
  'Игра с другом': 'Play with a friend',
  'Сложность соперника': 'Opponent difficulty',
  'Создашь комнату, поделишься кодом. Не дождёшься друга, место займёт бот.':
    'Create a room and share the code. If no friend shows up, a bot takes the seat.',
  'Играть ⚫️⚪️': 'Play ⚫️⚪️',
  'Создаём…': 'Creating…',
  'Создать комнату 👥': 'Create room 👥',
  'Ничья!': 'Draw!',
  'Ты выиграл!': 'You won!',
  'В этот раз мимо': 'Not this time',
  'Очки разделились поровну.': 'The points split evenly.',
  'Соперник сдался.': 'Your opponent resigned.',
  'Ты сдался.': 'You resigned.',
  'Чёрные': 'Black',
  'Белые': 'White',
  '(с коми)': '(with komi)',
  'в плену': 'captured',
  'монет': 'coins',
  'Ты': 'You',
  'В меню': 'Menu',
  'Играть ещё ⚫️⚪️': 'Play again ⚫️⚪️',
  'Домой': 'Home',

  // Home.tsx
  'Победы': 'Wins',
  'Рекорд': 'Best',
  'Монеты': 'Coins',
  'С ботом, выбери сложность': 'Vs a bot, pick a difficulty',
  'Быстрая игра': 'Quick game',
  'Случайный соперник онлайн': 'Random opponent online',
  'Создай комнату и поделись кодом': 'Create a room and share the code',
  'Войти по коду': 'Join by code',
  'Введи код из 4 символов': 'Enter a 4-character code',
  'Рейтинг': 'Leaderboard',
  'Правила': 'Rules',

  // Rules.tsx
  'Как играть': 'How to play',
  'Ставь камень': 'Place a stone',
  'Доска 9 на 9. В свой ход ставь камень на любое свободное пересечение линий. Камни не двигаются. Чёрные ходят первыми.':
    'The board is 9 by 9. On your turn, place a stone on any empty intersection. Stones do not move. Black plays first.',
  'Дыхания': 'Liberties',
  'У группы соединённых камней есть дыхания, это соседние пустые пункты по линиям. Пока есть хоть одно дыхание, группа живёт.':
    'A group of connected stones has liberties - the empty points adjacent to it along the lines. As long as it has at least one liberty, the group lives.',
  'Окружай и бери': 'Surround and capture',
  'Окружишь чужую группу так, что дыханий не осталось, и она снимается с доски как пленные. Углы и края брать проще, там меньше дыханий.':
    'Surround an enemy group so it has no liberties left, and it is taken off the board as prisoners. Corners and edges are easier to capture - they have fewer liberties.',
  'Нельзя в самоубийство': 'No suicide',
  'Нельзя ставить камень туда, где у него сразу нет дыханий, если только этим ходом ты не снимаешь камни соперника.':
    'You cannot place a stone where it would have no liberties, unless that move captures the opponent’s stones.',
  'Правило ко': 'The ko rule',
  'Нельзя сразу отыграть назад и вернуть доску в прежнее положение. Сначала сходи в другом месте, потом возвращайся.':
    'You cannot immediately recapture to return the board to its previous position. Play elsewhere first, then come back.',
  'Пас и конец партии': 'Passing and the end of the game',
  'Если ходить невыгодно, можно спасовать. Два паса подряд заканчивают партию. Доигрывайте границы, чтобы счёт был честным.':
    'If there is no good move, you can pass. Two passes in a row end the game. Finish the borders so the score is fair.',
  'Кто больше': 'Who has more',
  'Считаем по площади: свои камни плюс окружённая ими пустота. Белым добавляют коми за второй ход. У кого больше очков, тот и выиграл.':
    'Score by area: your own stones plus the empty space they surround. White gets komi for moving second. Whoever has more points wins.',

  // Lobby.tsx
  'КОД': 'CODE',
  'Входим…': 'Joining…',
  'Войти в игру': 'Join the game',
  'Ищем соперника': 'Finding an opponent',
  'Можно начать сейчас или подождать пару секунд': 'Start now or wait a couple of seconds',
  'в игре': 'in game',
  'Начинаем…': 'Starting…',
  'Начать сейчас ⚡': 'Start now ⚡',
  'Комната': 'Room',
  'Поделись кодом': 'Share the code',
  'Заходи ко мне в': 'Join me in',
  'Код комнаты': 'Room code',
  'Позвать друга ↗': 'Invite a friend ↗',
  'Сложность бота': 'Bot difficulty',
  'ХОЗЯИН': 'HOST',
  'БОТ': 'BOT',
  'готов': 'ready',
  'Ждём соперника': 'Waiting for an opponent',
  'Пустое место займёт бот, когда начнёшь.': 'An empty seat is filled by a bot when you start.',
  'Расставляем…': 'Setting up…',
  'Начать игру ⚫️⚪️': 'Start the game ⚫️⚪️',
  'Ждём, пока хозяин начнёт': 'Waiting for the host to start',

  // Game.tsx
  'Выйти': 'Leave',
  'Партия окончена': 'Game over',
  'Твой ход': 'Your turn',
  'Партия': 'Game',
  'Ходит': 'Turn:',
  'коми': 'komi',
  'Считаем территорию': 'Counting territory',
  'Соперник спасовал. Спасуй и ты, чтобы закончить': 'Your opponent passed. Pass too to finish',
  'Твой ход, ставь камень на пересечение': 'Your turn - place a stone on an intersection',
  'Ждём ход соперника': 'Waiting for the opponent’s move',
  'Пас': 'Pass',
  'Сдаться': 'Resign',
  'Сдаться?': 'Resign?',
  'Партия засчитается сопернику как победа.': 'The game counts as a win for your opponent.',
  'Продолжить игру': 'Keep playing',
  'чёрные': 'black',
  'белые': 'white',

  // Board.tsx aria-labels
  'Чёрный камень': 'Black stone',
  'Белый камень': 'White stone',
  'Поставить камень': 'Place a stone',
  'Пустой пункт': 'Empty point',

  // Leaderboard.tsx
  'Пока пусто. Сыграй партию, чтобы попасть в таблицу!':
    'Nothing here yet. Play a game to get on the board!',

  // difficulty.ts (shared) - wrapped at render sites
  'Новичок': 'Beginner',
  'Ставит наугад': 'Plays at random',
  'Знаток': 'Adept',
  'Бьёт и спасает': 'Captures and saves',
  'Мастер': 'Master',
  'Думает наперёд': 'Thinks ahead',

  // store.ts - event toasts (name + verb phrase)
  'пропускает ход': 'passes',
  'сдаётся': 'resigns',
  'не успел походить': 'ran out of time',

  // store.ts - move errors, status toasts
  'Сейчас не твой ход': 'It’s not your turn',
  'Здесь уже есть камень': 'There’s already a stone here',
  'Сюда нельзя: нет дыханий': 'You can’t play here: no liberties',
  'Нельзя сразу отыграть ко': 'You can’t retake the ko right away',
  'Сюда походить нельзя': 'You can’t play there',
  'Комната не найдена': 'Room not found',
  'Не удалось начать игру. Проверь связь.': 'Couldn’t start the game. Check your connection.',
  'Не удалось подобрать игру. Проверь связь.': 'Couldn’t find a match. Check your connection.',
  'Не удалось создать комнату. Проверь связь.': 'Couldn’t create the room. Check your connection.',
  'Нет комнаты с таким кодом.': 'No room with that code.',
  'Игра уже началась.': 'The game has already started.',
  'В комнате нет мест.': 'The room is full.',
  'Не удалось войти.': 'Couldn’t join.',
  'Не удалось начать': 'Couldn’t start',
  'Не удалось сдаться': 'Couldn’t resign',
}
