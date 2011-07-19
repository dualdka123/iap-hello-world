from google.appengine.ext import db


class Level(db.Model):
  """Holds meta-data for a level in the game"""
  owner = db.UserProperty()
  level = db.StringProperty(required=True)
  next_level = db.StringProperty(default='')
  base_rows = db.IntegerProperty(required=True)
  static_blocks = db.TextProperty(required=True) # will be python dict in json
  move_blocks = db.TextProperty(required=True) # will be python dict in json
  door = db.TextProperty(required=True) # will be python dict in json
  player_start = db.TextProperty(required=True) # will be python dict in json
  entity_size = db.IntegerProperty(default=64, required=True)
  canvas_width_blocks = db.IntegerProperty(default=24, required=True)
  canvas_height_blocks = db.IntegerProperty(default=10, required=True)
  step_size = db.IntegerProperty(default=10, required=True)


class PurchasedItem(db.Model):
  """Holds meta-data for a level in the game"""
  currency_code = db.StringProperty(required=True)
  federated_identity = db.StringProperty(required=True) # sellerData
  item_name = db.StringProperty(required=True)
  item_price = db.StringProperty(required=True)
  order_id = db.StringProperty(required=True)
