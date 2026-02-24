// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TrustChain {
    address public owner;

    /* ================= STRUCTS ================= */

    struct Product {
        string productId;
        string boxId;
        string name;
        string category;
        string manufacturer;
        string manufacturerDate;
        string manufacturePlace;
        string modelNumber;
        string serialNumber;
        string warrantyPeriod;
        string batchNumber;
        string color;
        string specs;
        uint256 price;
        string image;
        bool shipped;
        bool verifiedByRetailer;
        bool sold;
        bool verifiedBySystem;
    }

    struct ProductInput {
        string productId;
        string boxId;
        string name;
        string category;
        string manufacturer;
        string manufacturerDate;
        string manufacturePlace;
        string modelNumber;
        string serialNumber;
        string warrantyPeriod;
        string batchNumber;
        string color;
        string specs;
        uint256 price;
        string image;
    }

    /* ================= STORAGE ================= */

    mapping(string => Product) private products;
    mapping(string => string[]) private productsByBox;

    /* ================= EVENTS ================= */

    event BatchRegistered(
        string indexed batchNumber,
        string indexed boxId,
        uint256 productCount
    );

    event ProductRegistered(string indexed productId, string indexed boxId);
    event ProductShipped(string indexed productId);
    event ProductVerified(string indexed productId);
    event ProductSold(string indexed productId);
    event ProductSystemVerified(string indexed productId);

    /* ================= MODIFIERS ================= */

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /* ================= ⭐ BATCH REGISTER (CORE) ================= */

    function registerBatchProducts(
        string memory batchNumber,
        string memory boxId,
        ProductInput[] calldata items
    ) external {
        require(bytes(batchNumber).length > 0, "Missing batch number");
        require(bytes(boxId).length > 0, "Missing box ID");
        require(items.length > 0, "Empty batch");

        for (uint256 i = 0; i < items.length; i++) {
            ProductInput calldata p = items[i];
            require(bytes(p.productId).length > 0, "Missing product ID");

            require(
                bytes(products[p.productId].productId).length == 0,
                "Product already exists"
            );

            for (uint256 j = 0; j < i; j++) {
                require(
                    keccak256(bytes(items[j].productId)) !=
                        keccak256(bytes(p.productId)),
                    "Duplicate product ID in batch"
                );
            }

            products[p.productId] = Product(
                p.productId,
                boxId,
                p.name,
                p.category,
                p.manufacturer,
                p.manufacturerDate,
                p.manufacturePlace,
                p.modelNumber,
                p.serialNumber,
                p.warrantyPeriod,
                batchNumber,
                p.color,
                p.specs,
                p.price,
                p.image,
                false,
                false,
                false,
                false
            );

            productsByBox[boxId].push(p.productId);

            emit ProductRegistered(p.productId, boxId);
        }

        emit BatchRegistered(batchNumber, boxId, items.length);
    }

    /* ================= SHIP ================= */

    function shipBox(string memory _boxId) public {
    string[] memory ids = productsByBox[_boxId];
    require(ids.length > 0, "Box not found");

    for (uint i = 0; i < ids.length; i++) {
        if (!products[ids[i]].shipped) {
            products[ids[i]].shipped = true;
            emit ProductShipped(ids[i]);
        }
    }
}


    /* ================= VERIFY (Retailer) ================= */

    function verifyBox(string memory _boxId) external {
    string[] memory ids = productsByBox[_boxId];
    require(ids.length > 0, "Box not found");

    for (uint i = 0; i < ids.length; i++) {
        if (!products[ids[i]].verifiedByRetailer) {
            products[ids[i]].verifiedByRetailer = true;
            emit ProductVerified(ids[i]);
        }
    }
}

    function verifyProduct(string memory productId) external {
        require(bytes(products[productId].productId).length > 0, "Not registered");
        products[productId].verifiedByRetailer = true;
        emit ProductVerified(productId);
    }


    /* ================= SYSTEM VERIFY (Backend) ================= */

    function verifyBySystem(string memory productId) external onlyOwner {
        require(bytes(products[productId].productId).length > 0, "Not registered");
        products[productId].verifiedBySystem = true;
        emit ProductSystemVerified(productId);
    }

    /* ================= SALE ================= */

    function saleComplete(string memory productId) external {
        require(bytes(products[productId].productId).length > 0, "Not registered");
        products[productId].sold = true;
        emit ProductSold(productId);
    }

    /* ================= FETCH ================= */

    function getProduct(string memory productId)
        external
        view
        returns (Product memory)
    {
        return products[productId];
    }

    function getProductsByBox(string memory boxId)
        external
        view
        returns (string[] memory)
    {
        return productsByBox[boxId];
    }
}
