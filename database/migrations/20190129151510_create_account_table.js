
exports.up = knex => knex.schema.createTable('account', (table) => {
  table.increments('id'); // id serial primary key
  table.integer('user_id').unsigned().notNullable();
  table.string('name');
  table.string('surname');
  table.string('avatar_url');
  table.timestamp('updated_at', false);

  table.foreign('user_id').references('id').inTable('user_credentials');
});
exports.down = knex => knex.schema.dropTable('account');
