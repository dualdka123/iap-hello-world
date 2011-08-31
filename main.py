# Copyright 2011 Google Inc. All Rights Reserved.

# pylint: disable-msg=C6409,C6203

"""Separate models module for IAP Hello World."""

__author__ = 'dhermes@google.com (Danny Hermes)'

# standard library imports
import os
import pickle
import time

# third-party imports
from google.appengine.api import users
from google.appengine.ext import db
from google.appengine.ext import webapp
from google.appengine.ext.webapp import template
from google.appengine.ext.webapp.util import run_wsgi_app
import jwt

# application-specific imports
from constants import OPEN_ID_PROVIDERS
from models import Level
from models import PurchasedItem
from sellerinfo import SELLER_ID
from sellerinfo import SELLER_SECRET


def DBPIckle(value):
  """Returns anative python pickled and consumable by the GAE datastore."""
  return db.Text(pickle.dumps(value))


class MainHandler(webapp.RequestHandler):
  """Handles / as well as redirects for login required."""

  def get(self):
    """Handles get requests."""
    user = users.get_current_user()

    logged_in = (user is not None)
    if logged_in:
      # explicity disobeying:
      # http://code.google.com/appengine/docs/python/users/userclass.html
      # "If you use OpenID, you should not rely on this email address to
      # be correct. Applications should use nickname for displayable names."
      # In limited experience, it seems nickname == federated_identity
      display_name = user.email()
      sign_out = users.create_logout_url(self.request.uri)

      now = int(time.time())
      now_plus_one = now + 3600
      identity = user.federated_identity()

      request_info = {'currencyCode': 'USD',
                      'sellerData': identity}
      basic_jwt_info = {'iss': SELLER_ID,
                        'aud': 'Google',
                        'typ': 'google/payments/inapp/item/v1',
                        'iat': now,
                        'exp': now_plus_one,
                        'request': request_info}

      # Start off assuming the user has bought everything there is to buy
      can_purchase = False

      # Check every possible item to see if user has purchased
      levels_purchased = PurchasedItem.gql(("WHERE federated_identity = '%s' "
                                            "AND item_name = '%s'") %
                                           (identity, 'Levels'))
      levels = ['1']
      levels_token = ''
      if levels_purchased.count() > 0:
        levels.extend(['2', '3', '4', '5'])
      else:
        can_purchase = True
        request_info.update({'name': 'Levels', 'price': '0.50'})
        levels_token = jwt.encode(basic_jwt_info, SELLER_SECRET)

      sprite_purchased = PurchasedItem.gql(("WHERE federated_identity = '%s' "
                                            "AND item_name = '%s'") %
                                           (identity, 'Sprite'))
      sprite_token = ''
      if sprite_purchased.count() == 0:
        can_purchase = True
        request_info.update({'name': 'Sprite', 'price': '0.50'})
        sprite_token = jwt.encode(basic_jwt_info, SELLER_SECRET)

      builder_purchased = PurchasedItem.gql(("WHERE federated_identity = '%s' "
                                             "AND item_name = '%s'") %
                                            (identity, 'Builder'))
      user_levels = []
      builder_token = ''
      if builder_purchased.count() == 0:
        can_purchase = True
        request_info.update({'name': 'Builder', 'price': '2.00'})
        builder_token = jwt.encode(basic_jwt_info, SELLER_SECRET)
      else:
        level_query = Level.gql("WHERE owner = USER('%s')" % user.email())
        for level in level_query:
          user_levels.append(level.level)

      source_purchased = PurchasedItem.gql(("WHERE federated_identity = '%s' "
                                            "AND item_name = '%s'") %
                                           (identity, 'Source'))
      source_token = ''
      if source_purchased.count() == 0:
        can_purchase = True
        request_info.update({'name': 'Source', 'price': '8.00'})
        source_token = jwt.encode(basic_jwt_info, SELLER_SECRET)

      no_purchases = (levels_token and sprite_token and
                      builder_token and source_token)
      template_vals = {'logged_in': logged_in,
                       'display_name': display_name,
                       'sign_out': sign_out,
                       'levels': levels,
                       'user_levels': user_levels,
                       'levels_jwt': levels_token,
                       'sprite_jwt': sprite_token,
                       'builder_jwt': builder_token,
                       'source_jwt': source_token,
                       'can_purchase': can_purchase,
                       'no_purchases': no_purchases}
    else:
      # let user choose authenticator
      continue_url = self.request.GET.get('continue', None)
      dest_url = self.request.uri if continue_url is None else continue_url

      # Thanks to Wesley Chun
      # http://code.google.com/intl/pl/appengine/articles/openid.html
      providers = []
      for display, link in OPEN_ID_PROVIDERS:
        providers.append((users.create_login_url(dest_url=dest_url,
                                                 federated_identity=link),
                          display))

      template_vals = {'logged_in': logged_in,
                       'user_continue': continue_url,
                       'providers': providers}

    path = os.path.join(os.path.dirname(__file__), 'templates', 'index.html')
    self.response.out.write(template.render(path, template_vals))

  def post(self):
    """Handles post requests."""
    user = users.get_current_user()

    logged_in = (user is not None)
    if logged_in:
      identity = user.federated_identity()
      purchases = PurchasedItem.gql(
          ("WHERE federated_identity = '%s'" % identity))
      for purchase in purchases:
        purchase.delete()
    self.redirect('/')


class Play(webapp.RequestHandler):
  """Handler for levels."""

  def get(self):
    """Handles get requests."""
    level_name = self.request.get('level')

    curr_level = Level.gql("WHERE level = '%s'" % level_name)
    if curr_level.count() != 1:
      message = 'Level %s not found' % level_name
      template_vals = {'can_play': False,
                       'message': message}
      path = os.path.join(os.path.dirname(__file__),
                          'templates',
                          'game_play.html')
      self.response.out.write(template.render(path, template_vals))
      return

    curr_level = curr_level.get()
    user = users.get_current_user()
    next_level = curr_level.next_level  # To disable
    if curr_level.owner is None:
      levels_purchased = PurchasedItem.gql(("WHERE federated_identity = '%s' "
                                            "AND item_name = '%s'") %
                                           (user.federated_identity(),
                                            'Levels'))
      if not levels_purchased.count():
        if level_name != '1':
          message = 'You don\'t have access to Level %s' % level_name
          template_vals = {'can_play': False,
                           'message': message}
          path = os.path.join(os.path.dirname(__file__),
                              'templates',
                              'game_play.html')
          self.response.out.write(template.render(path, template_vals))
          return
        else:
          next_level = ''
    elif curr_level.owner != user:
      message = 'You don\'t have access to Level %s' % level_name
      template_vals = {'can_play': False,
                       'message': message}
      path = os.path.join(os.path.dirname(__file__),
                          'templates',
                          'game_play.html')
      self.response.out.write(template.render(path, template_vals))
      return

    sprite_purchased = PurchasedItem.gql(("WHERE federated_identity = '%s' "
                                          "AND item_name = '%s'") %
                                         (user.federated_identity(),
                                          'Sprite'))
    sprite = ('translate_robot-lb64'
              if sprite_purchased.count() else 'android-64')

    static_blocks = pickle.loads(str(curr_level.static_blocks))
    move_blocks = pickle.loads(str(curr_level.move_blocks))
    player_start = pickle.loads(str(curr_level.player_start))
    door = pickle.loads(str(curr_level.door))
    # pickle outputs str and expects it back, though app engine
    # stores and returns from the DB as unicode
    template_vals = {'can_play': True,
                     'entity_size': curr_level.entity_size,
                     'canvas_height_blocks': curr_level.canvas_height_blocks,
                     'canvas_width_blocks': curr_level.canvas_width_blocks,
                     'step_size': curr_level.step_size,
                     'sprite': sprite,
                     'base_blocks': curr_level.base_rows,
                     'player_start': player_start,
                     'door': door,
                     'static_blocks': static_blocks,
                     'move_blocks': move_blocks,
                     'next_level': next_level}

    path = os.path.join(os.path.dirname(__file__),
                        'templates',
                        'game_play.html')
    self.response.out.write(template.render(path, template_vals))


class BuildLevel(webapp.RequestHandler):
  """Level builder."""

  def ParseRowsFromRequest(self, key, delimiter=',',
                           base_rows=1, max_row=9, max_column=23):
    """Helper function for which parses rows from the request.

    Note: this ignores duplicates

    Args:
      request: server request being handled
      key: intended to be one of moveable or static, the types of blocks in
           the build level form
      delimiter: delimiter used to separate rows for a given column
      base_rows: base_rows from same request (minimum 1)
      max_row: maximum value a row can take
      max_column: maximum value a column can take

    Returns:
      Dictionary with columns are keys and input row values for that column.
      If the inputs are incorrectly specified or out of range, returns None.
    """
    result = {}
    input_row = 0
    column = self.request.get('%s_column%s' % (key, input_row), None)
    rows = self.request.get('%s_rows%s' % (key, input_row), None)
    while column is not None:
      try:
        column = int(column)
        if column < 0 or column > max_column:
          return None
      except (ValueError, TypeError):
        return None

      row_vals = result.setdefault(column, [])
      try:
        split_vals = rows.split(delimiter)
        for row in split_vals:
          try:
            row = int(row)
            if row < base_rows or row > max_row:
              return None
          except (ValueError, TypeError):
            return None
          if row not in row_vals:
            row_vals.append(row)
      except AttributeError:
        return None

      input_row += 1
      column = self.request.get('%s_column%s' % (key, input_row), None)
      rows = self.request.get('%s_rows%s' % (key, input_row), None)

    return result

  def get(self):
    """Handles get requests."""
    user = users.get_current_user()
    builder_purchased = PurchasedItem.gql(("WHERE federated_identity = '%s' "
                                           "AND item_name = '%s'") %
                                          (user.federated_identity(),
                                           'Builder'))
    can_build = (builder_purchased.count() > 0)
    denial_message = ('' if can_build else
                      'You don\'t have access to the Level Builder')
    template_vals = {'can_build': can_build,
                     'message': denial_message,
                     'error': False}

    path = os.path.join(os.path.dirname(__file__),
                        'templates',
                        'build_level.html')
    self.response.out.write(template.render(path, template_vals))

  def SendError(self, message, can_build):
    """Helper function to send error on invalid post."""
    template_vals = {'can_build': can_build,
                     'message': message,
                     'error': True}
    path = os.path.join(os.path.dirname(__file__),
                        'templates',
                        'build_level.html')
    self.response.out.write(template.render(path, template_vals))

  def post(self):
    """Handles post requests."""
    user = users.get_current_user()
    builder_purchased = PurchasedItem.gql(("WHERE federated_identity = '%s' "
                                           "AND item_name = '%s'") %
                                          (user.federated_identity(),
                                           'Builder'))
    can_build = (builder_purchased.count() > 0)

    level_name = self.request.get('level')
    if level_name in ['1', '2', '3', '4', '5']:
      self.SendError('%s is already a level' % level_name, can_build)
      return
    else:
      existing = Level.gql("WHERE owner = USER('%s') AND level='%s'"
                           % (user.email(), level_name))
      if existing.count():
        self.SendError('%s is already a level' % level_name, can_build)
        return

    # Validate base_rows
    max_column = 23
    max_row = 9

    base_rows = self.request.get('base_rows', None)
    try:
      base_rows = int(base_rows)
      if base_rows < 0 or base_rows > max_row:
        self.SendError(('%s is invalid for rows at bottom '
                        'of screen' % base_rows), can_build)
        return
    except (ValueError, TypeError):
      self.SendError(('%s is invalid for rows at bottom '
                      'of screen' % base_rows), can_build)
      return

    # Validate static
    static = self.ParseRowsFromRequest('static')
    if static is None:
      self.SendError(('Static Blocks invalid. Please use '
                      'integers and separate rows by commas'), can_build)
      return

    # Validate moveable
    moveable = self.ParseRowsFromRequest('moveable')
    if moveable is None:
      self.SendError(('Moveable Blocks invalid. Please use '
                      'integers and separate rows by commas'), can_build)
      return

    # Update static or fail if moveable and static share blocks;
    # also fail if a moveable block would end up hovering
    for column, row_list in moveable.iteritems():
      destination = static[column] if column in static else []
      for row in row_list:
        if row in destination:
          self.SendError(('Moveable and Static Blocks can\'t occupy '
                          'the same place'), can_build)
          return
        elif row > base_rows:  # if in row base_rows, block will be supported
          if row - 1 not in row_list + destination:
            self.SendError('Moveable can\'t hover', can_build)
            return

    # Validate door
    door_column = self.request.get('door_column', '')
    door_row = self.request.get('door_row', '')
    try:
      door_column = int(door_column)
      door_row = int(door_row)
      # Door must be on screen;
      # Door has height of 2 blocks, so can't start in the top row
      if (door_row < base_rows or door_row > max_row - 1 or
          door_column < 0 or door_column > max_column):
        self.SendError('Door out of bounds', can_build)
        return

      # Door must not conflict with squares
      if door_column in static:
        if (door_row in static[door_column] or
            door_row + 1 in static[door_column]):
          self.SendError('Door conflicts with Static Blocks', can_build)
          return
      elif door_column in moveable:
        if (door_row in moveable[door_column] or
            door_row + 1 in moveable[door_column]):
          self.SendError('Door conflicts with Moveable Blocks', can_build)
          return
    except (ValueError, TypeError):
      self.SendError('Door values invalid', can_build)
      return

    door = {'row': door_row,
            'column': door_column}

    # Validate player
    player_column = self.request.get('player_column', '')
    player_row = self.request.get('player_row', '')
    try:
      player_column = int(player_column)
      player_row = int(player_row)
      # Player must start on screen
      if (player_row < base_rows or player_row > max_row or
          player_column < 0 or player_column > max_column):
        self.SendError('Player out of bounds', can_build)
        return

      # Make sure no collisions with obstacles; though
      # Player *CAN* start in the door if the creator wants it
      if player_column in static and player_row in static[player_column]:
        self.SendError('Player conflicts with Static Blocks', can_build)
        return
      elif player_column in moveable and player_row in moveable[player_column]:
        self.SendError('Player conflicts with Moveable Blocks', can_build)
        return

      # Player must start on ground
      if player_row != base_rows:
        block_below = False
        if player_column in static:
          if player_row - 1 in static[player_column]:
            block_below = True
        if player_column in moveable:
          if player_row - 1 in moveable[player_column]:
            block_below = True

        if not block_below:
          self.SendError('Player must start grounded', can_build)
          return
    except (ValueError, TypeError):
      self.SendError('Player values invalid', can_build)
      return

    player_start = {'x': player_column*64,  # default entity_size
                    'y': 64*(10 - (player_row + 1))}  # default canvas_height

    new_level = Level(owner=user,
                      level=level_name,
                      base_rows=base_rows,
                      static_blocks=DBPIckle(static),
                      move_blocks=DBPIckle(moveable),
                      door=DBPIckle(door),
                      player_start=DBPIckle(player_start))
    new_level.put()

    self.redirect('/play?level=%s' % level_name)


class PostbackVerify(webapp.RequestHandler):
  """Handler for server postback, as per recommendations.

  Receives at /postback-verify

  https://sites.google.com/site/inapppaymentsapi/getting-started
  "Google sends an HTTP POST message when a transaction completes successfully.
  The body of the message contains just one parameter, named jwt. The value of
  the jwt parameter is a JWT with the same fields (and most of the same values)
  as the JWT that was in buyItem(), plus one additional field: "orderId".

  To verify that the purchase is valid, your server first needs to decode JWT in
  the POST. If so, then your server should record the purchase and respond with
  a 200 OK that contains the the order ID. For details, see Handling Postbacks.

  Important: The transaction is canceled if your server takes longer than 10
  seconds to send a 200 OK response."
  """

  def post(self):
    """Handles post request."""
    encoded_jwt = self.request.get('jwt', None)
    if encoded_jwt is not None:
      # jwt.decode won't accept unicode, cast to str
      # http://github.com/progrium/pyjwt/issues/4
      decoded_jwt = jwt.decode(str(encoded_jwt), SELLER_SECRET)

      # Only update datastore and respond to Google if we have all the values
      # we need. If not, the payment will not go through since the postback
      # will not have a response to validate
      if decoded_jwt['iss'] == 'Google' and decoded_jwt['aud'] == SELLER_ID:
        if ('response' in decoded_jwt and
            'orderId' in decoded_jwt['response'] and
            'request' in decoded_jwt):
          order_id = decoded_jwt['response']['orderId']
          request_info = decoded_jwt['request']
          if ('currencyCode' in request_info and 'sellerData' in request_info
              and 'name' in request_info and 'price' in request_info):
            item = PurchasedItem(currency_code=request_info['currencyCode'],
                                 federated_identity=request_info['sellerData'],
                                 item_name=request_info['name'],
                                 item_price=request_info['price'],
                                 order_id=order_id)
            item.put()

            self.response.out.write(order_id)


class Instructions(webapp.RequestHandler):
  """Instructions for gameplay."""

  def get(self):
    """Handles get requests."""
    path = os.path.join(os.path.dirname(__file__),
                        'templates',
                        'instructions.html')
    self.response.out.write(template.render(path, {}))


class Throw404(webapp.RequestHandler):
  """Catches all non-specified (404) requests."""

  def get(self):
    """Handles get requests."""
    self.error(404)
    template_vals = {'uri': self.request.application_url}
    path = os.path.join(os.path.dirname(__file__), 'templates', '404.html')
    self.response.out.write(template.render(path, template_vals))


application = webapp.WSGIApplication([
    ('/', MainHandler),
    ('/_ah/login_required', MainHandler),
    ('/play', Play),
    ('/build-level', BuildLevel),
    ('/instructions', Instructions),
    ('/postback-verify', PostbackVerify),
    ('/.*', Throw404),
], debug=True)


def main():
  run_wsgi_app(application)


if __name__ == '__main__':
  main()
