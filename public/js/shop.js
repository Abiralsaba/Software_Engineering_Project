document.addEventListener('DOMContentLoaded', () => {
    loadShopItems();
    updateCartCount();

    // check for payment status in URL
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const orderId = urlParams.get('order_id');

    if (status === 'success') {
        Swal.fire({
            icon: 'success',
            title: 'Payment Successful!',
            text: `Order #${orderId} has been confirmed. Thank you!`,
        }).then(() => {
            // Clear URL
            window.history.replaceState({}, document.title, window.location.pathname);
            updateCartCount(); // Cart should be empty now
        });
    } else if (status === 'fail') {
        Swal.fire({
            icon: 'error',
            title: 'Payment Failed',
            text: `Order #${orderId} could not be processed. Please try again.`,
        });
    } else if (status === 'cancel') {
        Swal.fire({
            icon: 'info',
            title: 'Payment Cancelled',
            text: 'You cancelled the payment process.',
        });
    }
});

// Close Modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Load Shop Items
async function loadShopItems() {
    const grid = document.getElementById('shopItemsGrid');

    try {
        const response = await fetch('/api/shop/items', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const items = await response.json();

        if (items.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">No items available.</p>';
            return;
        }

        grid.innerHTML = items.map(item => {
            const isIcon = item.image_url && item.image_url.includes('<i');
            const imgHtml = isIcon
                ? `<div class="product-icon">${item.image_url}</div>`
                : `<img src="${item.image_url}" alt="${item.name}" class="product-image-cover">`;

            return `
            <div class="product-card">
                <div class="product-img-container">${imgHtml}</div>
                <h3>${item.name}</h3>
                <p style="color:var(--text-muted); margin: 0.5rem 0;">${item.description}</p>
                <h2 style="color:#34d399">৳ ${item.price}</h2>
                <button class="btn-buy" onclick="addToCart(${item.id})">Add to Cart</button>
            </div>
        `}).join('');

    } catch (error) {
        console.error('Error loading items:', error);
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">Failed to load products.</p>';
    }
}

// Add to Cart
// Add to Cart
async function addToCart(itemId) {
    console.log('addToCart called with ID:', itemId);

    // Visual Feedback: Find the button and change text temporarily (hacky but works without passing context)
    // Ideally pass 'this' or event, but for now let's use the ID to find if we can or just use Swal
    // actually, Swal is enough, but user said "maybe its not a button". Click feedback is important

    // let's try to find the button by traversing from event if passed, or just global feedback
    // Use Swal with loading spinner
    Swal.fire({
        title: 'Adding to Cart...',
        text: 'Please wait',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        console.log('Sending request to /api/shop/cart...');
        const response = await fetch('/api/shop/cart', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ item_id: itemId, quantity: 1 })
        });
        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);

        if (data.success) {
            Swal.fire({
                icon: 'success',
                title: 'Added to Cart',
                text: 'Item has been successfully added to your cart',
                showConfirmButton: false,
                timer: 1500
            });
            updateCartCount();
        } else {
            console.error('Server returned error:', data);
            Swal.fire('Error', data.error || 'Failed to add to cart. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error adding to cart:', error);
        Swal.fire('Error', 'An network error occurred. Is the server running?', 'error');
    }
}

// Update Cart Count
async function updateCartCount() {
    try {
        const response = await fetch('/api/shop/cart', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const cartItems = await response.json();

        let count = 0;
        cartItems.forEach(item => count += item.quantity);
        document.getElementById('cartCountHeader').textContent = count;
    } catch (error) {
        console.error('Error updating cart count:', error);
    }
}

// Open Cart Modal
async function openCartModal() {
    const modal = document.getElementById('cartModal');
    const list = document.getElementById('cartItemsList');
    const totalEl = document.getElementById('cartTotal');

    modal.style.display = 'flex';
    list.innerHTML = '<p class="empty-state">Loading...</p>';

    try {
        const response = await fetch('/api/shop/cart', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const cartItems = await response.json();

        if (cartItems.length === 0) {
            list.innerHTML = '<p class="empty-state"><i class="fas fa-shopping-basket"></i><br>Your cart is empty</p>';
            totalEl.textContent = '৳ 0';
            return;
        }

        let total = 0;
        list.innerHTML = cartItems.map(item => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;
            const isIcon = item.image_url && item.image_url.includes('<i');
            const imgHtml = isIcon
                ? `<div class="product-icon" style="font-size: 1.5rem; color: var(--text-muted);">${item.image_url}</div>`
                : `<img src="${item.image_url}" alt="${item.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px;">`;
            return `
                <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        ${imgHtml}
                        <div>
                            <h4 style="margin: 0; color: white;">${item.name}</h4>
                            <p style="margin: 0; color: var(--text-muted);">৳ ${item.price} x ${item.quantity}</p>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <span style="font-weight: bold; color: #34d399;">৳ ${itemTotal}</span>
                        <button onclick="removeFromCart(${item.cart_id})" style="background: none; border: none; color: #ef4444; cursor: pointer;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        totalEl.textContent = '৳ ' + total;

    } catch (error) {
        console.error('Error loading cart:', error);
        list.innerHTML = '<p class="empty-state">Failed to load cart.</p>';
    }
}

// Remove from Cart
async function removeFromCart(cartId) {
    try {
        const response = await fetch(`/api/shop/cart/${cartId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await response.json();

        if (data.success) {
            openCartModal(); // Reload cart
            updateCartCount();
        } else {
            Swal.fire('Error', data.error || 'Failed to remove', 'error');
        }
    } catch (error) {
        console.error('Error removing from cart:', error);
    }
}

// Open Checkout Modal
function openCheckoutModal() {
    closeModal('cartModal');
    document.getElementById('checkoutModal').style.display = 'flex';
}



// Handle Checkout Form
document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const contactNumber = document.getElementById('contactNumber').value;
    const deliveryAddress = document.getElementById('deliveryAddress').value;
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;

    try {
        const response = await fetch('/api/shop/order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                contact_number: contactNumber,
                delivery_address: deliveryAddress,
                payment_method: paymentMethod
            })
        });
        const data = await response.json();

        if (data.success) {
            if (data.payment_url) {
                // Redirect to Payment Gateway
                window.location.href = data.payment_url;
            } else {
                // COD Success
                closeModal('checkoutModal');
                updateCartCount(); // Should be 0
                Swal.fire('Order Placed!', data.message, 'success');
            }
        } else {
            Swal.fire('Error', data.error || 'Failed to place order', 'error');
        }
    } catch (error) {
        console.error('Error placing order:', error);
        Swal.fire('Error', 'Failed to place order', 'error');
    }
});
