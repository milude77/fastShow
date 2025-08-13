import React, { useState } from 'react';

const SearchUser = () => {
    const [userId, setUserId] = useState('');

    const handleSearch = () => {
        // Placeholder for search logic
        console.log('Searching for user with ID:', userId);
    };

    return (
        <div>
            <h3>Search for User</h3>
            <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter User ID"
            />
            <button onClick={handleSearch}>Search</button>
        </div>
    );
};

export default SearchUser;
