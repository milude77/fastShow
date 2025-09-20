exports.up = function(knex) {
  return knex.schema.table('messages', function(table) {
    // 添加消息类型字段，默认为文本消息
    table.string('message_type', 50).defaultTo('text'); // 'text' or 'file'
    
    // 文件相关字段
    table.string('file_name', 255).nullable();
    table.string('file_path', 500).nullable();
    table.string('file_url', 500).nullable();
    table.bigInteger('file_size').nullable();
    table.string('mime_type', 100).nullable();
    table.string('file_id', 100).nullable(); 
  });
};

exports.down = function(knex) {
  return knex.schema.table('messages', function(table) {
    table.dropColumn('message_type');
    table.dropColumn('file_name');
    table.dropColumn('file_path');
    table.dropColumn('file_url');
    table.dropColumn('file_size');
    table.dropColumn('mime_type');
    table.dropColumn('file_id');
  });
};