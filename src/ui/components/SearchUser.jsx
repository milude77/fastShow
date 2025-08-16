import React from 'react';

function SearchUser({ onSearch, searchTerm, setSearchTerm, searchResults, onAddFriend }) {
  return (
    <div>
      <form onSubmit={onSearch}>
        <input
          type="text"
          placeholder="按用户名搜索"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ marginRight: '5px' }}
        />
        <button type="submit">搜索</button>
      </form>
      <div style={{ marginTop: '10px' }}>
        {searchResults.map(user => (
          <div key={user.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <span>{user.username} ({user.id})</span>
            <button onClick={() => onAddFriend(user.id)}>添加好友</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SearchUser;
