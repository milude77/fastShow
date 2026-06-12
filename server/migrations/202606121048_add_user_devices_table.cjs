exports.up = async (knex) => {
    return knex.schema.createTable('user_devices', (table) => {
        table.string('id', 36).primary();
        table.string('user_id')
            .notNullable()
            .references('id')
            .inTable('users')
            .onDelete('CASCADE')
            .index();
        table.string('device_id', 100).notNullable().unique();
        table.string('device_name', 100).notNullable();
        table.text('identity_public_key').notNullable();
        table.timestamp('last_active_at').defaultTo(knex.fn.now());
        table.timestamps(true, true);
    })
}

exports.down = async (knex) => {
    return knex.schema.dropTable('user_devices');
}