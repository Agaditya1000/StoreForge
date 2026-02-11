<?php
// Enable COD payment gateway
update_option("woocommerce_cod_settings", array(
    "enabled" => "yes",
    "title" => "Cash on Delivery",
    "description" => "Pay with cash upon delivery.",
    "instructions" => "Pay with cash upon delivery."
));
echo "COD payment enabled\n";

// Set store address
update_option("woocommerce_store_address", "123 Main St");
update_option("woocommerce_store_city", "San Francisco");
update_option("woocommerce_store_postcode", "94101");
echo "Store address set\n";

// Create a sample product using wp_insert_post (no WC classes needed)
$product_id = wp_insert_post(array(
    'post_title'   => 'Sample T-Shirt',
    'post_content' => 'A comfortable sample t-shirt for testing your store checkout flow.',
    'post_status'  => 'publish',
    'post_type'    => 'product',
));

if ($product_id && !is_wp_error($product_id)) {
    update_post_meta($product_id, '_price', '19.99');
    update_post_meta($product_id, '_regular_price', '19.99');
    update_post_meta($product_id, '_stock_status', 'instock');
    update_post_meta($product_id, '_visibility', 'visible');
    update_post_meta($product_id, '_virtual', 'no');
    update_post_meta($product_id, '_downloadable', 'no');
    update_post_meta($product_id, '_manage_stock', 'no');
    wp_set_object_terms($product_id, 'simple', 'product_type');
    echo "Sample product created (ID: $product_id)\n";
} else {
    echo "Product creation failed\n";
}

echo "WooCommerce setup complete!\n";
