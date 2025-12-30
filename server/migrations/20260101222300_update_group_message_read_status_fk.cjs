exports.up = function(knex) {
  return knex.schema.alterTable("group_message_read_status", function (table) {
    // 1. Drop existing foreign key and primary key
    table.dropForeign(["group_message_id"]);
    table.dropPrimary();

    // 2. Alter group_message_id column to string
    table.string("group_message_id", 255).alter();

    // 3. Add new foreign key constraint
    table.foreign("group_message_id").references("message_id").inTable("group_messages").onDelete("CASCADE");

    // 4. Re-add the composite primary key
    table.primary(["group_message_id", "user_id"]);
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable("group_message_read_status", function (table) {
    // Revert changes in reverse order
    table.dropForeign(["group_message_id"]);
    table.dropPrimary();

    table.integer("group_message_id").alter();

    table.foreign("group_message_id").references("id").inTable("group_messages").onDelete("CASCADE");
    table.primary(["group_message_id", "user_id"]);
  });
};
