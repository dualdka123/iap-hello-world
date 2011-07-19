from main import db_pickle
from main import Level


level_one = Level(level='1', next_level='2', base_rows=4,
                  static_blocks=db_pickle({7: [4, 5], 13: [4], 17: [4, 5]}),
                  move_blocks=db_pickle({2: [4], 10: [4]}),
                  door=db_pickle({'row': 4, 'column': 23}),
                  player_start=db_pickle({'x': 256, 'y': 320}))
level_one.put()
level_two = Level(level='2', next_level='3', base_rows=4,
                  static_blocks=db_pickle({12: [4, 5], 23: [4, 5, 6]}),
                  move_blocks=db_pickle({0: [4, 5], 3: [4], 22: [4]}),
                  door=db_pickle({'row': 7, 'column': 23}),
                  player_start=db_pickle({'x': 256, 'y': 320}))
level_two.put()
level_three = Level(level='3', next_level='4', base_rows=3,
                    static_blocks=db_pickle(
                      {0: [3, 4],  1: [3, 4],  2: [3, 4],
                       3: [3, 4],  4: [3, 4],  5: [3, 4],
                       11: [3, 4],  12: [3, 4],  13: [3, 4],
                       14: [3, 4], 15: [3, 4], 16: [3, 4],
                       17: [3, 4], 18: [3, 4], 19: [3, 4],
                       20: [3, 4], 21: [3, 4], 22: [3, 4],
                       23: [3, 4]}),
                    move_blocks=db_pickle({0: [5]}),
                    door=db_pickle({'row': 5, 'column': 23}),
                    player_start=db_pickle({'x': 256, 'y': 256}))
level_three.put()
level_four = Level(level='4', next_level='5', base_rows=2,
                   static_blocks=db_pickle(
                     {0: [2, 3], 1: [2, 3], 2: [2, 3],
                      3: [2, 3], 4: [2, 3], 5: [2, 3],
                      6: [2, 3], 7: [2, 3], 8: [2, 3],
                      9: [6], 10: [6], 11: [6], 12: [6],
                      13: [6], 14: [6], 15: [6],
                      16: [2, 3], 17: [2, 3], 18: [2, 3],
                      19: [2, 3], 20: [2, 3], 21: [2, 3],
                      22: [2, 3], 23: [2, 3]}),
                   move_blocks=db_pickle({0: [4], 21: [4],
                                          22: [4, 5], 23: [4, 5]}),
                   door=db_pickle({'row': 7, 'column': 12}),
                   player_start=db_pickle({'x': 256, 'y': 320}))
level_four.put()
level_five = Level(level='5', base_rows=2,
                   static_blocks=db_pickle({0: [4], 1: [2],
                                            17: [2, 3, 4, 5]}),
                   move_blocks=db_pickle({0: [5], 14: [2],
                                          15: [2, 3], 16: [2, 3]}),
                   door=db_pickle({'row': 2, 'column': 22}),
                   player_start=db_pickle({'x': 320, 'y': 448}))
level_five.put()

